const { Client } = require('pg');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.rate_limits (
      ip TEXT PRIMARY KEY,
      attempts INT DEFAULT 0,
      lockout_until BIGINT DEFAULT 0
    );
  `);
  console.log("Created rate_limits table.");

  await client.query(`
    ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS semantic_embedding vector(768);
  `);
  console.log("Added semantic_embedding column.");

  await client.query(`
    CREATE OR REPLACE FUNCTION match_semantic(
      query_embedding vector(768),
      match_threshold float,
      match_count int
    )
    RETURNS TABLE (
      id uuid,
      similarity float
    )
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT
        photos.id,
        1 - (photos.semantic_embedding <=> query_embedding) AS similarity
      FROM photos
      WHERE 1 - (photos.semantic_embedding <=> query_embedding) > match_threshold
      ORDER BY photos.semantic_embedding <=> query_embedding
      LIMIT match_count;
    END;
    $$;
  `);
  console.log("Created match_semantic function.");

  await client.end();
}
run();

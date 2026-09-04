const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  // 1. Create rate_limits table
  let { error } = await supabase.rpc('exec_sql', { sql: `
    CREATE TABLE IF NOT EXISTS public.rate_limits (
      ip TEXT PRIMARY KEY,
      attempts INT DEFAULT 0,
      lockout_until BIGINT DEFAULT 0
    );
  `});
  if (error) console.error("Rate limit table error:", error);
  else console.log("Created rate_limits table.");

  // 2. Add semantic_embedding to photos
  let { error: e2 } = await supabase.rpc('exec_sql', { sql: `
    ALTER TABLE public.photos ADD COLUMN IF NOT EXISTS semantic_embedding vector(768);
  `});
  if (e2) console.error("Semantic embedding error:", e2);
  else console.log("Added semantic_embedding column.");

  // 3. Create a match_semantic function for semantic search
  let { error: e3 } = await supabase.rpc('exec_sql', { sql: `
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
  `});
  if (e3) console.error("match_semantic error:", e3);
  else console.log("Created match_semantic function.");
}
run();

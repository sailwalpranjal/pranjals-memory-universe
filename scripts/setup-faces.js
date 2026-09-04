require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function setup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS people (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        name TEXT,
        cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS photo_faces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
        person_id UUID REFERENCES people(id) ON DELETE SET NULL,
        bounding_box JSONB,
        embedding vector(128),
        confidence FLOAT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );
    `);

    // Relational and Vector Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_photo_faces_photo_id ON photo_faces(photo_id);
      CREATE INDEX IF NOT EXISTS idx_photo_faces_person_id ON photo_faces(person_id);
      CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
      CREATE INDEX IF NOT EXISTS idx_photo_faces_embedding_hnsw 
        ON photo_faces USING hnsw (embedding vector_l2_ops);
    `);

    // PostgreSQL RPC: match_faces using Euclidean L2 distance (<->)
    await client.query(`
      CREATE OR REPLACE FUNCTION match_faces(
        query_embedding vector(128),
        match_threshold float DEFAULT 0.55,
        match_count int DEFAULT 1
      )
      RETURNS TABLE (
        face_id UUID,
        person_id UUID,
        distance float
      )
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RETURN QUERY
        SELECT
          pf.id AS face_id,
          pf.person_id,
          (pf.embedding <-> query_embedding)::float AS distance
        FROM photo_faces pf
        WHERE pf.embedding IS NOT NULL
          AND (pf.embedding <-> query_embedding) <= match_threshold
        ORDER BY pf.embedding <-> query_embedding ASC
        LIMIT match_count;
      END;
      $$;
    `);

    // PostgreSQL RPC: merge_people for merging person clusters
    await client.query(`
      CREATE OR REPLACE FUNCTION merge_people(
        target_person_id UUID,
        source_person_ids UUID[]
      )
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF source_person_ids IS NULL OR array_length(source_person_ids, 1) IS NULL THEN
          RETURN;
        END IF;

        -- Reassign photo faces to target person
        UPDATE photo_faces
        SET person_id = target_person_id
        WHERE person_id = ANY(source_person_ids);

        -- If target has no cover photo, use cover photo from one of the source people
        UPDATE people
        SET cover_photo_id = COALESCE(
          people.cover_photo_id,
          (SELECT cover_photo_id FROM people WHERE id = ANY(source_person_ids) AND cover_photo_id IS NOT NULL LIMIT 1)
        )
        WHERE id = target_person_id;

        -- Delete source people
        DELETE FROM people
        WHERE id = ANY(source_person_ids)
          AND id != target_person_id;
      END;
      $$;
    `);
    
    console.log("Faces tables, HNSW vector indexes, and RPC functions created successfully.");
  } catch (err) {
    console.error("DB Faces Setup Error:", err);
    throw err;
  } finally {
    await client.end();
  }
}

setup();

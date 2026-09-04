require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');
const { createClient } = require('@supabase/supabase-js');

async function setup() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log("Connected to PostgreSQL.");
    
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID,
        original_filename TEXT,
        checksum TEXT,
        perceptual_hash TEXT,
        mime_type TEXT,
        size_bytes BIGINT,
        width INTEGER,
        height INTEGER,
        captured_at TIMESTAMP WITH TIME ZONE,
        imported_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        visibility TEXT DEFAULT 'PRIVATE',
        storage_path TEXT
      );
    `);
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS photo_metadata (
        photo_id UUID PRIMARY KEY REFERENCES photos(id) ON DELETE CASCADE,
        make TEXT,
        model TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        city TEXT,
        country TEXT,
        ai_title TEXT,
        ai_description TEXT,
        ai_tags TEXT[]
      );
    `);

    // Safe migrations for existing databases
    await client.query(`
      ALTER TABLE photo_metadata 
        ADD COLUMN IF NOT EXISTS ai_title TEXT,
        ADD COLUMN IF NOT EXISTS ai_description TEXT,
        ADD COLUMN IF NOT EXISTS ai_tags TEXT[];

      ALTER TABLE photos 
        ADD COLUMN IF NOT EXISTS perceptual_hash TEXT,
        ADD COLUMN IF NOT EXISTS width INTEGER,
        ADD COLUMN IF NOT EXISTS height INTEGER,
        ADD COLUMN IF NOT EXISTS cloudinary_url TEXT,
        ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT,
        ADD COLUMN IF NOT EXISTS storage_provider TEXT DEFAULT 'supabase',
        ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;
    `);

    // Performance B-Tree Indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_photos_checksum ON photos(checksum);
      CREATE INDEX IF NOT EXISTS idx_photos_perceptual_hash ON photos(perceptual_hash);
      CREATE INDEX IF NOT EXISTS idx_photos_captured_at ON photos(captured_at DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS idx_photos_user_id ON photos(user_id);
      CREATE INDEX IF NOT EXISTS idx_photo_metadata_city ON photo_metadata(city);
      CREATE INDEX IF NOT EXISTS idx_photo_metadata_country ON photo_metadata(country);
      CREATE INDEX IF NOT EXISTS idx_photo_metadata_lat_lng ON photo_metadata(latitude, longitude);
    `);
    
    // People and face recognition tables  
    await client.query(`
      CREATE TABLE IF NOT EXISTS people (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        cover_photo_id UUID,
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

      CREATE TABLE IF NOT EXISTS meetings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
        title TEXT NOT NULL,
        person_id UUID REFERENCES people(id) ON DELETE SET NULL,
        scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        duration_minutes INTEGER DEFAULT 30,
        status TEXT DEFAULT 'scheduled',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS collections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID DEFAULT '00000000-0000-0000-0000-000000000000',
        title TEXT NOT NULL,
        description TEXT,
        category TEXT DEFAULT 'custom',
        cover_photo_id UUID REFERENCES photos(id) ON DELETE SET NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS collection_photos (
        collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
        photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
        added_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
        PRIMARY KEY (collection_id, photo_id)
      );
    `);

    // pgvector IVFFlat index for cosine similarity on face embeddings
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_photo_faces_embedding ON photo_faces 
      USING ivfflat (embedding vector_cosine_ops) WITH (lists = 10);
    `).catch(() => { /* Index may require data first */ });

    // Drop and recreate match_faces RPC to support schema changes
    await client.query(`DROP FUNCTION IF EXISTS match_faces(vector, double precision, integer);`);
    
    // match_faces RPC using cosine distance
    await client.query(`
      CREATE OR REPLACE FUNCTION match_faces(
        query_embedding vector(128),
        match_threshold float DEFAULT 0.5,
        match_count int DEFAULT 10
      )
      RETURNS TABLE (
        id UUID,
        photo_id UUID,
        person_id UUID,
        bounding_box JSONB,
        confidence FLOAT,
        similarity FLOAT
      )
      LANGUAGE SQL STABLE
      AS $$
        SELECT
          pf.id,
          pf.photo_id,
          pf.person_id,
          pf.bounding_box,
          pf.confidence,
          1 - (pf.embedding <=> query_embedding) AS similarity
        FROM photo_faces pf
        WHERE pf.embedding IS NOT NULL
          AND 1 - (pf.embedding <=> query_embedding) > match_threshold
        ORDER BY pf.embedding <=> query_embedding
        LIMIT match_count;
      $$;
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_photo_faces_photo_id ON photo_faces(photo_id);
      CREATE INDEX IF NOT EXISTS idx_photo_faces_person_id ON photo_faces(person_id);
      CREATE INDEX IF NOT EXISTS idx_people_created_at ON people(created_at DESC);
    `);

    console.log("Core tables, migrations, match_faces RPC, and indexes created successfully.");
  } catch (err) {
    console.error("DB Setup Error:", err);
    throw err;
  } finally {
    await client.end();
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.storage.createBucket('memories', {
    public: false,
    fileSizeLimit: 20485760 // 20MB
  });
  
  if (error) {
    if (error.message.includes('already exists') || error.message.includes('Duplicate')) {
      console.log("Bucket 'memories' already exists.");
    } else {
      console.error("Storage Bucket Error:", error.message);
    }
  } else {
    console.log("Bucket 'memories' created successfully.");
  }
}

setup();

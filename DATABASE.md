# Pranjal's Universe — Database Schema & Data Models

## Database Engine
PostgreSQL (Hosted on Supabase) connected via connection pool (`pg` Client) and Supabase JS Client with Service Role credentials.

## Schema Overview

### 1. `photos` Table
Primary registry of ingested media assets (photos, videos, and voice memos).
- `id` (UUID, Primary Key, default gen_random_uuid())
- `user_id` (UUID, default '00000000-0000-0000-0000-000000000000')
- `original_filename` (TEXT, NOT NULL)
- `storage_path` (TEXT, NOT NULL)
- `file_size` (BIGINT, NOT NULL)
- `mime_type` (TEXT, NOT NULL)
- `sha256_hash` (TEXT, UNIQUE, NOT NULL)
- `captured_at` (TIMESTAMPTZ)
- `imported_at` (TIMESTAMPTZ, default now())
- `is_favorite` (BOOLEAN, default FALSE)
- `is_archived` (BOOLEAN, default FALSE)
- `storage_provider` (TEXT, default 'supabase')
- `cloudinary_public_id` (TEXT)
- `cloudinary_url` (TEXT)

### 2. `photo_metadata` Table
Factual EXIF metadata and AI-derived descriptors.
- `id` (UUID, Primary Key)
- `photo_id` (UUID, Foreign Key -> photos.id ON DELETE CASCADE)
- `make`, `model`, `lens` (TEXT)
- `focal_length`, `aperture`, `shutter_speed`, `iso` (NUMERIC / TEXT)
- `latitude`, `longitude`, `altitude` (DOUBLE PRECISION)
- `city`, `country`, `landmark` (TEXT)
- `ai_title` (TEXT)
- `ai_description` (TEXT)
- `ai_tags` (TEXT[])

### 3. `people` Table
People recognized and confirmed in Pranjal's life.
- `id` (UUID, Primary Key)
- `name` (TEXT, NOT NULL)
- `relationship` (TEXT)
- `profile_photo_id` (UUID)
- `created_at` (TIMESTAMPTZ, default now())

### 4. `faces` Table
Detected face bounding boxes and embeddings.
- `id` (UUID, Primary Key)
- `photo_id` (UUID, Foreign Key -> photos.id ON DELETE CASCADE)
- `person_id` (UUID, Foreign Key -> people.id ON DELETE SET NULL)
- `bounding_box` (JSONB)
- `descriptor` (FLOAT8[])
- `confidence` (FLOAT4)

### 5. `meetings` Table
Private audio/video sessions and scheduled gatherings.
- `id` (UUID, Primary Key)
- `title` (TEXT, NOT NULL)
- `scheduled_at` (TIMESTAMPTZ, NOT NULL)
- `duration_minutes` (INTEGER, default 30)
- `person_id` (UUID, Foreign Key -> people.id ON DELETE SET NULL)
- `notes` (TEXT)
- `status` (TEXT, default 'scheduled')
- `created_at` (TIMESTAMPTZ, default now())

### 6. `collections` & `collection_photos` Tables
Curated albums, journeys, and personal storylines.
- `collections`: `id`, `name`, `category`, `description`, `cover_photo_id`, `created_at`
- `collection_photos`: `id`, `collection_id`, `photo_id`, `added_at`

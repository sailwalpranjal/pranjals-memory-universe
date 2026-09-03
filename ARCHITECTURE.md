# Pranjal's Universe — System Architecture

## Overview
Pranjal's Universe is an offline-first, multimodal personal memory archive built with Next.js 14 App Router, PostgreSQL (Supabase), Cloudinary Online CDN, and Google Gemini 2.5 Flash.

```
+--------------------------------------------------------------------------------+
|                                CLIENT APPLICATION                              |
|  - Gallery & Live Camera Capture (Photo / Video / Voice Memo)                  |
|  - Timeline & Historical "On This Day" Flashbacks                              |
|  - Creative Studio & 2K Collage Canvas Engine                                  |
|  - Playable Memory Puzzles (Blur Reveal, Chrono Order, Pairs)                 |
|  - The Lab & Shaders (Before/After Slider, Palette Extraction)                 |
|  - Private Meetings (WebRTC Video / Audio / Chat / People Context)             |
|  - Offline Queue (IndexedDB Buffer + Auto-Sync)                                 |
+---------------------------------------+----------------------------------------+
                                        |
                                        v
+--------------------------------------------------------------------------------+
|                             NEXT.JS API SERVICE LAYER                          |
|  /api/upload        - Multi-format ingestion, SHA-256 deduplication            |
|  /api/photos        - Signed URL resolution, cache-busting headers             |
|  /api/meetings      - Room scheduling, attendee linkage, instant rooms         |
|  /api/collections   - Albums curation, covers, photo attachments               |
|  /api/on-this-day   - Anniversary memory discovery                             |
|  /api/ai/describe   - Gemini 2.5 Flash multimodal vision analysis              |
|  /api/export        - Complete JSON relational dataset serialization           |
|  /api/cloudinary    - CDN connection health check and cloud synchronization    |
+-------------------+------------------------------+-----------------------------+
                    |                              |
                    v                              v
+------------------------------------+  +----------------------------------------+
|        DATABASE & STORAGE          |  |         EXTERNAL CLOUD ENGINES         |
|  - PostgreSQL (Supabase):          |  |  - Cloudinary CDN (Images):            |
|    photos, metadata, faces,        |  |    Strict 'pranjal_universe_' prefix,  |
|    people, places, meetings,       |  |    tag-isolated mirror                 |
|    collections, collection_photos  |  |  - Google Gemini 2.5 Flash:            |
|  - Supabase Private Storage:       |  |    Poetic narratives, sensory tags     |
|    'memories' bucket, signed URLs  |  |  - OpenStreetMap Nominatim:            |
+------------------------------------+  |    Reverse-geocoding coordinates       |
                                        +----------------------------------------+
```

## Architectural Principles
1. **Save First, Process Second**: Media persistence is immediate. Background tasks (face detection, EXIF parsing, Gemini analysis) execute asynchronously and never block upload completion.
2. **Dual-Mirror Storage**: Fast public CDN delivery via Cloudinary paired with private encrypted backup in Supabase Storage with dynamic signed tokens.
3. **Zero Placeholders**: All components and modal interactions connect to real PostgreSQL records and storage objects.
4. **Zero Emojis**: High-end minimalist design utilizing Lucide SVG icons and luxury typography.

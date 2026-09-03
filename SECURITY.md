# Pranjal's Universe — Security Architecture & Privacy Policy

## Core Security Safeguards

### 1. Zero Secrets in Client Bundles
- Server-side environment variables (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `GEMINI_API_KEY`, `CLOUDINARY_API_SECRET`) are never prefixed with `NEXT_PUBLIC_` and are never bundled into client JavaScript.
- All database mutations and AI calls execute within serverless Route Handlers (`src/app/api/*`).

### 2. Private Object Storage & Signed URLs
- The Supabase storage bucket `memories` is configured as private.
- Media cannot be accessed via static public URLs. All photos require cryptographically signed URLs generated on-demand with limited lifespans.

### 3. Strict Cloudinary Isolation
- Any foreign media uploaded to the shared Cloudinary account that lacks the `pranjal_universe_` prefix or `pranjal_universe` tag is strictly filtered out by the backend and UI.

### 4. Input Validation & MIME Guarding
- Uploaded media streams are validated against allowed MIME types (`image/*`, `video/*`, `audio/*`).
- Image processing engines (Sharp, EXIF parser) are shielded from binary audio/video formats to prevent buffer overflows or server crashes.

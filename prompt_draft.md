# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Fix all discrepancies identified in the audit and complete Phases 1-12
> Requested team: Full team

You need to fix all broken features and implement all missing phases for a Next.js 14 web application ("Pranjal's Universe") to ensure it perfectly aligns with the original 12-phase specification. The application must be production-ready with zero placeholders or fake data.

Working directory: e:/BrowserLens/memory-universe
Integrity mode: benchmark

## Requirements

### R1. Fix Existing Implementation Discrepancies (Phases 2, 4, 6, 7, 9, 10)
- **Phase 4**: Implement the `match_faces` Postgres RPC using pgvector `<->` cosine distance. Connect the UI to cluster faces into actual people profiles instead of hardcoding "Unknown Person".
- **Phase 2**: Implement `perceptual_hash` logic for near-duplicate detection and fix the N+1 signed URL generation loop.
- **Phase 6**: Fix the `/api/search/route.ts` SQL bug that applies `original_filename ILIKE %q%` prematurely, discarding valid location matches. Fix the array property access bug on `photo_metadata`.
- **Phase 7**: Add `ai_title`, `ai_description`, and `ai_tags` to `setup-db.js`.
- **Phases 9 & 10**: Wire up the "Download Creation" button in `/make` to actually export a canvas image. Make `/lab` use actual user uploaded photos from Supabase instead of a remote Unsplash URL.

### R2. Implement Missing Phases (Phases 8, 11, 12)
- **Phase 8 (Social Relationships)**: Create the UI and logic for person management (merging clusters, renaming, viewing shared places).
- **Phase 11 (Local-First)**: Implement basic Service Worker and IndexedDB caching so the app can load offline.
- **Phase 12 (Export & Archival)**: Add a settings panel where the user can trigger a JSON and ZIP export of their metadata and photos.

## Acceptance Criteria

### Production Readiness
- [ ] No hardcoded "Unknown Person" or "Unknown Location" strings exist in the active rendering paths.
- [ ] No `console.log`, `TODO`, or placeholder buttons remain in the UI.
- [ ] The `setup-db.js` file successfully executes without errors and includes all required schema columns (like AI fields and pgvector functions).
- [ ] The `/api/search` route correctly filters by both filename and metadata without crashing.

---
*Next: Delegating via invoke_subagent*

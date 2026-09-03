# Pranjal's Universe — Testing & Quality Assurance

## Automated Test Suite
Run the test suite with:
```bash
npm test
```

## Test Coverage

### 1. Zero Emoji Audit
- Scans all files in `src/` (`.ts`, `.tsx`, `.js`) using Unicode emoji block regular expressions to guarantee strict compliance with the zero-emoji design requirement.

### 2. API Endpoint Health
- `GET /api/photos`: Validates HTTP 200, array schema, and signed URL generation.
- `GET /api/meetings`: Validates HTTP 200 and room list schema.
- `GET /api/collections`: Validates HTTP 200 and album list schema.
- `GET /api/on-this-day`: Validates HTTP 200 and historical memory discovery schema.
- `GET /api/ai/status`: Validates HTTP 200 and Google Gemini API key configuration.
- `GET /api/export`: Validates HTTP 200 and relational JSON export schema.

### 3. UI Route Health
Validates HTTP 200 across all 10 core views:
- `/` (Home Dashboard & Historical Flashbacks)
- `/gallery` (Memory Gallery & Live Camera Capture)
- `/timeline` (Chronological Archive)
- `/meet` (Private Meetings Dashboard)
- `/collections` (Albums & Archive Curation)
- `/puzzles` (Playable Memory Puzzles)
- `/make` (Creative Studio & 2K Collages)
- `/lab` (The Lab & Film Shaders)
- `/settings` (Settings & Infrastructure)
- `/search` (Universal Search)

### Test Results
```
TOTAL TESTS: 24
PASSED: 24
FAILED: 0
```

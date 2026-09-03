const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';

async function fetchRoute(endpoint, options = {}) {
  return new Promise((resolve) => {
    const url = new URL(endpoint, BASE_URL);
    const req = http.request(
      url,
      {
        method: options.method || 'GET',
        headers: options.headers || {},
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
            json: () => {
              try {
                return JSON.parse(body);
              } catch {
                return null;
              }
            },
          });
        });
      }
    );
    req.on('error', (err) => resolve({ status: 500, error: err.message }));
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

function runEmojiAudit(dir) {
  const emojiRegex = /[\u{1F300}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/u;
  const violations = [];

  function scan(curr) {
    const entries = fs.readdirSync(curr, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(curr, e.name);
      if (e.isDirectory()) {
        if (e.name !== 'node_modules' && e.name !== '.next' && !e.name.startsWith('.')) {
          scan(full);
        }
      } else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) {
        const text = fs.readFileSync(full, 'utf8');
        const lines = text.split('\n');
        lines.forEach((l, idx) => {
          if (emojiRegex.test(l)) {
            violations.push(`${full}:${idx + 1}: ${l.trim()}`);
          }
        });
      }
    }
  }

  scan(dir);
  return violations;
}

async function runTests() {
  console.log('=== STARTING AUTOMATED TEST SUITE: PRANJAL\'S UNIVERSE ===\n');
  let passed = 0;
  let failed = 0;

  function assert(name, condition, detail = '') {
    if (condition) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name} ${detail ? `- ${detail}` : ''}`);
      failed++;
    }
  }

  // 1. Zero Emoji Audit
  const emojiViolations = runEmojiAudit(path.join(__dirname, '..', 'src'));
  assert(
    'Zero Emojis in Source Code',
    emojiViolations.length === 0,
    emojiViolations.join('; ')
  );

  // 2. Health check: /api/photos
  const resPhotos = await fetchRoute('/api/photos');
  assert('/api/photos returns HTTP 200', resPhotos.status === 200);
  const jsonPhotos = resPhotos.json();
  assert(
    '/api/photos payload contains valid photos array',
    Array.isArray(jsonPhotos?.photos) && jsonPhotos.photos.length > 0,
    `Found ${jsonPhotos?.photos?.length || 0} photos`
  );
  if (jsonPhotos?.photos?.length > 0) {
    const hasSignedUrl = jsonPhotos.photos.every((p) => typeof p.url === 'string' && p.url.length > 10);
    assert('All photos have signed or CDN URLs', hasSignedUrl);
  }

  // 3. Health check: /api/meetings
  const resMeetings = await fetchRoute('/api/meetings');
  assert('/api/meetings returns HTTP 200', resMeetings.status === 200);
  const jsonMeetings = resMeetings.json();
  assert(
    '/api/meetings payload contains valid rooms array',
    Array.isArray(jsonMeetings?.meetings)
  );

  // 4. Health check: /api/collections
  const resCollections = await fetchRoute('/api/collections');
  assert('/api/collections returns HTTP 200', resCollections.status === 200);
  const jsonCollections = resCollections.json();
  assert(
    '/api/collections payload contains valid collections array',
    Array.isArray(jsonCollections?.collections)
  );

  // 5. Health check: /api/on-this-day
  const resOnThisDay = await fetchRoute('/api/on-this-day');
  assert('/api/on-this-day returns HTTP 200', resOnThisDay.status === 200);
  const jsonOnThisDay = resOnThisDay.json();
  assert(
    '/api/on-this-day returns memories array',
    Array.isArray(jsonOnThisDay?.memories)
  );

  // 6. Health check: /api/ai/status
  const resAiStatus = await fetchRoute('/api/ai/status');
  assert('/api/ai/status returns HTTP 200', resAiStatus.status === 200);
  const jsonAiStatus = resAiStatus.json();
  assert(
    'Gemini AI API Key is configured and verified active',
    jsonAiStatus?.configured === true
  );

  // 7. Health check: /api/export
  const resExport = await fetchRoute('/api/export?format=json');
  assert('/api/export returns HTTP 200', resExport.status === 200);
  const jsonExport = resExport.json();
  assert(
    'Full Archive Export contains structured schema',
    jsonExport && jsonExport.version === '1.0' && Array.isArray(jsonExport.photos)
  );

  // 8. Security Headers Verification
  const homeRes = await fetchRoute('/');
  const permPolicy = homeRes.headers['permissions-policy'];
  assert(
    'Permissions-Policy header is configured with camera and microphone restrictions',
    typeof permPolicy === 'string' && permPolicy.includes('camera=(self)') && permPolicy.includes('microphone=(self)')
  );
  assert(
    'X-Content-Type-Options is nosniff',
    homeRes.headers['x-content-type-options'] === 'nosniff'
  );

  // 9. Bulk API Validation
  const resBulkBad = await fetchRoute('/api/photos/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'favorite', ids: [] }),
  });
  assert('POST /api/photos/bulk rejects empty selection with HTTP 400', resBulkBad.status === 400);

  // 10. AI Studio Assistant Test
  const resStudioAi = await fetchRoute('/api/ai/studio-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: 'Make a cinematic night poster from Tokyo',
      photos: [
        { id: 'test-1', original_filename: 'tokyo_night.jpg', city: 'Tokyo', tags: ['night', 'neon'] },
        { id: 'test-2', original_filename: 'shibuya.jpg', city: 'Tokyo', tags: ['street'] },
      ],
    }),
  });
  assert('POST /api/ai/studio-assistant returns HTTP 200', resStudioAi.status === 200);
  const jsonStudioAi = resStudioAi.json();
  assert(
    'AI Studio Assistant returns valid template proposal and theme',
    typeof jsonStudioAi?.template === 'string' && typeof jsonStudioAi?.themeName === 'string'
  );

  // 11. AI Memory Generator Test
  const resGenMem = await fetchRoute('/api/ai/generate-memory', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mood: 'Cinematic & Film',
      limit: 3,
    }),
  });
  assert('POST /api/ai/generate-memory returns HTTP 200', resGenMem.status === 200);
  const jsonGenMem = resGenMem.json();
  assert(
    'AI Memory Generator synthesizes authentic memory with title and narrative',
    jsonGenMem?.success === true && typeof jsonGenMem?.memory?.title === 'string' && typeof jsonGenMem?.memory?.narrative === 'string'
  );

  // 12. Core UI Routes Health
  const uiRoutes = ['/', '/gallery', '/timeline', '/meet', '/collections', '/puzzles', '/make', '/lab', '/settings', '/search'];
  for (const r of uiRoutes) {
    const res = await fetchRoute(r);
    assert(`UI Route ${r} renders with HTTP 200`, res.status === 200);
  }

  // Summary
  console.log('\n=======================================');
  console.log(`TOTAL TESTS: ${passed + failed}`);
  console.log(`PASSED: ${passed}`);
  console.log(`FAILED: ${failed}`);
  console.log('=======================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});

import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos, getSignedUrlForPhoto, StoragePathLike } from '../src/lib/storage';

dotenv.config({ path: '.env.local' });

// ANSI styling for test terminal output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const MAGENTA = '\x1b[35m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failureDetails: string[] = [];

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✓ PASS${RESET} - ${testName}`);
  } else {
    failedTests++;
    const errMsg = `FAIL: ${testName}${detail ? ` | Detail: ${detail}` : ''}`;
    failureDetails.push(errMsg);
    console.error(`  ${RED}✗ FAIL${RESET} - ${testName}`);
    if (detail) {
      console.error(`    ${RED}Detail: ${detail}${RESET}`);
    }
  }
}

interface TestPhotoMetadata {
  photo_id?: string;
  city?: string | null;
  country?: string | null;
  make?: string | null;
  model?: string | null;
  ai_title?: string | null;
  ai_description?: string | null;
  ai_tags?: string[] | string | null;
}

interface TestPhotoRow {
  id: string;
  storage_path: string;
  original_filename: string;
  captured_at: string | null;
  imported_at: string | null;
  photo_metadata?: TestPhotoMetadata | TestPhotoMetadata[] | null;
}

async function runChallengerTestSuite() {
  console.log(`\n${BOLD}${MAGENTA}======================================================================${RESET}`);
  console.log(`${BOLD}${MAGENTA}  EMPIRICAL CHALLENGER 1: Milestone 2 Adversarial Test Suite          ${RESET}`);
  console.log(`${BOLD}${MAGENTA}  Search, AI Enrichment, Timeline Chronology & Storage Batch URL Tests${RESET}`);
  console.log(`${BOLD}${MAGENTA}======================================================================${RESET}\n`);

  // =========================================================================
  // SUITE 1: Search Filtering Logic with Synthetic Mock Payloads
  // =========================================================================
  console.log(`${BOLD}${YELLOW}=== SUITE 1: Multi-Dimensional Search Filter Logic (Adversarial Mocks) ===${RESET}`);

  // Synthetic mock database representing raw PostgreSQL rows with PostgREST 1:1 join shapes
  const syntheticPhotos: TestPhotoRow[] = [
    {
      id: 'photo-kyoto',
      storage_path: 'photos/2026/05/DSC_001.jpg',
      original_filename: 'DSC_001.jpg',
      captured_at: '2026-05-15T14:30:00Z',
      imported_at: '2026-05-15T15:00:00Z',
      // PostgREST 1:1 joined relations often returned as single-element array
      photo_metadata: [
        {
          photo_id: 'photo-kyoto',
          city: 'Kyoto',
          country: 'Japan',
          make: 'Sony',
          model: 'ILCE-7M4',
          ai_title: 'Historic Bamboo Grove',
          ai_description: 'Towering green bamboo stalks along a cobblestone path in Arashiyama.',
          ai_tags: ['bamboo', 'japan', 'nature', 'zen', 'green']
        }
      ]
    },
    {
      id: 'photo-sunset',
      storage_path: 'photos/2026/06/IMG_4821.png',
      original_filename: 'IMG_4821.png',
      captured_at: '2026-06-20T19:45:00Z',
      imported_at: '2026-06-20T20:00:00Z',
      // Direct object metadata representation
      photo_metadata: {
        photo_id: 'photo-sunset',
        city: 'Santa Monica',
        country: 'United States',
        make: 'Apple',
        model: 'iPhone 15 Pro',
        ai_title: 'Golden Sunset Over the Pacific Pier',
        ai_description: 'Vivid orange waves crashing against the wooden stilts at twilight.',
        ai_tags: ['sunset', 'pier', 'ocean', 'dusk', 'california']
      }
    },
    {
      id: 'photo-dsc-raw',
      storage_path: 'photos/2026/01/DSC_001.raw',
      original_filename: 'DSC_001.raw',
      captured_at: '2026-01-10T08:00:00Z',
      imported_at: '2026-01-10T09:00:00Z',
      // Empty array metadata
      photo_metadata: []
    },
    {
      id: 'photo-null-meta',
      storage_path: 'photos/2025/11/random_mountain.jpg',
      original_filename: 'random_mountain.jpg',
      captured_at: '2025-11-05T12:00:00Z',
      imported_at: '2025-11-05T13:00:00Z',
      // Null metadata
      photo_metadata: null
    },
    {
      id: 'photo-corrupted-meta',
      storage_path: 'photos/2024/02/weird_sensor.heic',
      original_filename: 'weird_sensor.heic',
      captured_at: '2024-02-29T10:00:00Z',
      imported_at: '2024-02-29T11:00:00Z',
      // Corrupted / malformed types in metadata
      photo_metadata: [
        {
          photo_id: 'photo-corrupted-meta',
          city: null,
          country: null,
          make: '12345',
          model: null,
          ai_tags: ['kyoto-special-tag']
        }
      ]
    },
    {
      id: 'photo-legacy-string-tags',
      storage_path: 'photos/2023/07/fireworks.jpg',
      original_filename: 'fireworks.jpg',
      captured_at: '2023-07-04T21:00:00Z',
      imported_at: '2023-07-04T22:00:00Z',
      // Legacy string tag representation
      photo_metadata: {
        photo_id: 'photo-legacy-string-tags',
        city: 'Tokyo',
        country: 'Japan',
        make: 'Nikon',
        model: 'Z9',
        ai_title: 'Kyoto Memories Celebration in Tokyo',
        ai_description: 'Fireworks illuminating the night sky over the bay.',
        ai_tags: 'sunset_glow, celebration, festival'
      }
    }
  ];

  // Implementation of search filter algorithm from search/route.ts
  function executeSearchFilter(photos: TestPhotoRow[], query: string, limit: number = 50) {
    const rawPhotos = photos;
    let filteredPhotos = rawPhotos;
    const q = (query || '').trim().toLowerCase();

    if (q) {
      filteredPhotos = rawPhotos.filter((p) => {
        const meta = Array.isArray(p.photo_metadata) ? p.photo_metadata[0] : p.photo_metadata;

        const matchName = typeof p.original_filename === 'string' && p.original_filename.toLowerCase().includes(q);
        const matchCity = typeof meta?.city === 'string' && meta.city.toLowerCase().includes(q);
        const matchCountry = typeof meta?.country === 'string' && meta.country.toLowerCase().includes(q);
        const matchAiTitle = typeof meta?.ai_title === 'string' && meta.ai_title.toLowerCase().includes(q);
        const matchAiDesc = typeof meta?.ai_description === 'string' && meta.ai_description.toLowerCase().includes(q);
        const matchAiTags = Array.isArray(meta?.ai_tags)
          ? meta.ai_tags.some((tag: unknown) => typeof tag === 'string' && tag.toLowerCase().includes(q))
          : typeof meta?.ai_tags === 'string' && (meta.ai_tags as string).toLowerCase().includes(q);
        const matchMake = typeof meta?.make === 'string' && meta.make.toLowerCase().includes(q);
        const matchModel = typeof meta?.model === 'string' && meta.model.toLowerCase().includes(q);

        return (
          matchName ||
          matchCity ||
          matchCountry ||
          matchAiTitle ||
          matchAiDesc ||
          matchAiTags ||
          matchMake ||
          matchModel
        );
      });
    }

    return filteredPhotos.slice(0, limit);
  }

  // Test 1.1: Query "Kyoto" -> matches photo via city even though filename is DSC_001.jpg
  const kyotoMatches = executeSearchFilter(syntheticPhotos, 'Kyoto');
  const matchedKyotoIds = kyotoMatches.map(p => p.id);
  assert(
    matchedKyotoIds.includes('photo-kyoto'),
    'Search Query "Kyoto": Matches photo-kyoto via city "Kyoto" despite filename being "DSC_001.jpg"',
    `Found IDs: ${matchedKyotoIds.join(', ')}`
  );
  assert(
    matchedKyotoIds.includes('photo-corrupted-meta'),
    'Search Query "Kyoto": Matches photo-corrupted-meta via tag "kyoto-special-tag"',
    `Found IDs: ${matchedKyotoIds.join(', ')}`
  );
  assert(
    matchedKyotoIds.includes('photo-legacy-string-tags'),
    'Search Query "Kyoto": Matches photo-legacy-string-tags via ai_title "Kyoto Memories Celebration in Tokyo"',
    `Found IDs: ${matchedKyotoIds.join(', ')}`
  );

  // Test 1.2: Query "sunset" -> matches photo via AI tags
  const sunsetMatches = executeSearchFilter(syntheticPhotos, 'sunset');
  const matchedSunsetIds = sunsetMatches.map(p => p.id);
  assert(
    matchedSunsetIds.includes('photo-sunset'),
    'Search Query "sunset": Matches photo-sunset via AI tags array ["sunset", ...]',
    `Found IDs: ${matchedSunsetIds.join(', ')}`
  );
  assert(
    matchedSunsetIds.includes('photo-legacy-string-tags'),
    'Search Query "sunset": Matches photo-legacy-string-tags via string tag "sunset_glow"',
    `Found IDs: ${matchedSunsetIds.join(', ')}`
  );
  assert(
    !matchedSunsetIds.includes('photo-kyoto') && !matchedSunsetIds.includes('photo-null-meta'),
    'Search Query "sunset": Does not match unrelated photos (kyoto, null-meta)',
    `Found IDs: ${matchedSunsetIds.join(', ')}`
  );

  // Test 1.3: Query "DSC_001" -> matches photo via filename
  const dscMatches = executeSearchFilter(syntheticPhotos, 'DSC_001');
  const matchedDscIds = dscMatches.map(p => p.id);
  assert(
    matchedDscIds.includes('photo-kyoto') && matchedDscIds.includes('photo-dsc-raw'),
    'Search Query "DSC_001": Matches both "DSC_001.jpg" and "DSC_001.raw" by filename',
    `Found IDs: ${matchedDscIds.join(', ')}`
  );
  assert(
    !matchedDscIds.includes('photo-sunset'),
    'Search Query "DSC_001": Excludes non-matching filenames like "IMG_4821.png"',
    `Found IDs: ${matchedDscIds.join(', ')}`
  );

  // Test 1.4: Verify array property access on photo_metadata: [{ city: 'Kyoto' }] does not return undefined
  const kyotoPhoto = syntheticPhotos.find(p => p.id === 'photo-kyoto')!;
  const rawArrayMeta = kyotoPhoto.photo_metadata;
  // Demonstration of previous bug:
  const buggyAccess = (rawArrayMeta as any)?.city;
  // Fixed access:
  const normalizedMeta = Array.isArray(rawArrayMeta) ? rawArrayMeta[0] : rawArrayMeta;
  const fixedAccess = normalizedMeta?.city;

  assert(
    buggyAccess === undefined,
    'Array Property Access [Oracle Verification]: Direct property access on array photo_metadata.city correctly reproduces undefined (validating why normalization is essential)'
  );
  assert(
    fixedAccess === 'Kyoto',
    'Array Property Access [Fix Verification]: Normalized access Array.isArray ? [0] : obj returns "Kyoto" without undefined error',
    `Actual: "${fixedAccess}"`
  );

  // Test 1.5: Verify camera make and model matching
  const sonyMatches = executeSearchFilter(syntheticPhotos, 'sony');
  assert(
    sonyMatches.length === 1 && sonyMatches[0].id === 'photo-kyoto',
    'Search Camera Make: Matches "sony" to photo-kyoto',
    `Matched length: ${sonyMatches.length}`
  );
  const z9Matches = executeSearchFilter(syntheticPhotos, 'z9');
  assert(
    z9Matches.length === 1 && z9Matches[0].id === 'photo-legacy-string-tags',
    'Search Camera Model: Matches "z9" to photo-legacy-string-tags',
    `Matched length: ${z9Matches.length}`
  );

  // Test 1.6: Case insensitivity and whitespace trimming
  const mixedCaseMatches = executeSearchFilter(syntheticPhotos, '   kYoTo   ');
  assert(
    mixedCaseMatches.some(p => p.id === 'photo-kyoto'),
    'Search Case & Whitespace: Query "   kYoTo   " successfully matches photo-kyoto'
  );

  // Test 1.7: Empty query returns all photos up to limit
  const allPhotos = executeSearchFilter(syntheticPhotos, '');
  assert(
    allPhotos.length === syntheticPhotos.length,
    `Search Empty Query: Returns all ${syntheticPhotos.length} photos`,
    `Returned: ${allPhotos.length}`
  );

  // Test 1.8: Non-existent query returns empty array
  const emptyMatches = executeSearchFilter(syntheticPhotos, 'xyz_absolutely_non_existent_123');
  assert(
    emptyMatches.length === 0,
    'Search Non-Existent Query: Returns empty array []',
    `Returned: ${emptyMatches.length}`
  );

  // =========================================================================
  // SUITE 2: Timeline Chronological Sorting & Descending Date Grouping
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}=== SUITE 2: Timeline Chronological Sorting & Date Grouping ===${RESET}`);

  // Adversarial timeline dataset with out-of-order captured_at, missing captured_at, and duplicate dates
  const rawTimelinePhotos = [
    { id: 'item-2026-09-02-night', captured_at: '2026-09-02T23:59:59Z', imported_at: '2026-09-02T23:59:59Z', storage_path: 'p1.jpg' },
    { id: 'item-2026-09-01-morning', captured_at: '2026-09-01T08:00:00Z', imported_at: '2026-09-01T08:30:00Z', storage_path: 'p2.jpg' },
    { id: 'item-2026-08-15-noon', captured_at: '2026-08-15T12:30:00Z', imported_at: '2026-08-15T13:00:00Z', storage_path: 'p3.jpg' },
    { id: 'item-2026-08-15-morning', captured_at: '2026-08-15T08:15:00Z', imported_at: '2026-08-15T09:00:00Z', storage_path: 'p4.jpg' },
    { id: 'item-2025-12-31-newyearseve', captured_at: '2025-12-31T23:59:59Z', imported_at: '2026-01-01T10:00:00Z', storage_path: 'p5.jpg' },
    { id: 'item-fallback-import-2025', captured_at: null, imported_at: '2025-06-15T10:00:00Z', storage_path: 'p6.jpg' },
    { id: 'item-undated-1', captured_at: null, imported_at: null, storage_path: 'p7.jpg' },
    { id: 'item-undated-2', captured_at: 'invalid-date-string-xyz', imported_at: null, storage_path: 'p8.jpg' }
  ];

  // Shuffle photos to simulate unordered ingestion from DB
  const shuffledTimelinePhotos = [...rawTimelinePhotos].sort(() => Math.random() - 0.5);

  function executeTimelineBuilder(photos: typeof rawTimelinePhotos) {
    const grouped: Record<string, typeof photos> = {};
    photos.forEach((photo) => {
      const dateTarget = photo.captured_at || photo.imported_at;
      let dateStr = 'Undated';
      if (dateTarget) {
        try {
          const d = new Date(dateTarget);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
          }
        } catch {
          dateStr = 'Undated';
        }
      }
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(photo);
    });

    const sortedDateKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Undated') return 1;
      if (b === 'Undated') return -1;
      return b.localeCompare(a);
    });

    return sortedDateKeys.map(dateStr => ({
      date: dateStr,
      photos: grouped[dateStr]
    }));
  }

  const timelineResult = executeTimelineBuilder(shuffledTimelinePhotos);
  const bucketDates = timelineResult.map(b => b.date);

  // Test 2.1: Verify bucket date keys are strictly descending with 'Undated' last
  const expectedDateOrder = [
    '2026-09-02',
    '2026-09-01',
    '2026-08-15',
    '2025-12-31',
    '2025-06-15',
    'Undated'
  ];

  assert(
    JSON.stringify(bucketDates) === JSON.stringify(expectedDateOrder),
    'Timeline Bucket Order: Date buckets are strictly descending with Undated at the end',
    `Expected: ${JSON.stringify(expectedDateOrder)}, Actual: ${JSON.stringify(bucketDates)}`
  );

  // Test 2.2: Verify items with older captured_at are chronologically placed AFTER newer captured_at items
  for (let i = 0; i < timelineResult.length - 1; i++) {
    const currentBucket = timelineResult[i];
    const nextBucket = timelineResult[i + 1];

    if (nextBucket.date !== 'Undated' && currentBucket.date !== 'Undated') {
      const currentDate = new Date(currentBucket.date).getTime();
      const nextDate = new Date(nextBucket.date).getTime();
      assert(
        currentDate > nextDate,
        `Timeline Chronology: Bucket [${currentBucket.date}] occurs chronologically BEFORE [${nextBucket.date}] (newer before older)`
      );
    }
  }

  // Test 2.3: Verify multi-photo grouping on the same day (2026-08-15)
  const aug15Bucket = timelineResult.find(b => b.date === '2026-08-15');
  assert(
    Boolean(aug15Bucket && aug15Bucket.photos.length === 2),
    'Timeline Grouping: 2026-08-15 contains exactly 2 grouped photos',
    `Found count: ${aug15Bucket?.photos.length}`
  );

  // Test 2.4: Fallback from null captured_at to imported_at
  const fallbackBucket = timelineResult.find(b => b.date === '2025-06-15');
  assert(
    Boolean(fallbackBucket && fallbackBucket.photos.some(p => p.id === 'item-fallback-import-2025')),
    'Timeline Fallback: Photo with null captured_at successfully falls back to imported_at date (2025-06-15)'
  );

  // Test 2.5: Undated bucket collects null and invalid dates
  const undatedBucket = timelineResult.find(b => b.date === 'Undated');
  assert(
    Boolean(undatedBucket && undatedBucket.photos.length === 2),
    'Timeline Undated: Collects both null captured_at/imported_at and invalid date strings',
    `Found count: ${undatedBucket?.photos.length}`
  );

  // =========================================================================
  // SUITE 3: Batch Signed URL Mapping (getSignedUrlsForPhotos)
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}=== SUITE 3: Batch Storage Signed URL Mapping (getSignedUrlsForPhotos) ===${RESET}`);

  // Create a mock Supabase client to observe batch storage calls, chunking, and deduplication
  let createSignedUrlsCallCount = 0;
  const chunkRequestsReceived: string[][] = [];

  const mockStorageSupabase = {
    storage: {
      from: (bucketName: string) => ({
        createSignedUrls: async (paths: string[], expiresIn: number) => {
          createSignedUrlsCallCount++;
          chunkRequestsReceived.push([...paths]);
          // Simulate standard Supabase storage return structure
          const data = paths.map((path) => ({
            error: null,
            path,
            signedUrl: `https://storage.supabase.co/${bucketName}/${path}?token=mock_signed_token_${expiresIn}`
          }));
          return { data, error: null };
        },
        createSignedUrl: async (path: string, expiresIn: number) => {
          return {
            data: {
              signedUrl: `https://storage.supabase.co/${bucketName}/${path}?token=single_token_${expiresIn}`
            },
            error: null
          };
        }
      })
    }
  } as unknown as SupabaseClient;

  // Test 3.1: Empty and invalid inputs return empty Map without network calls
  createSignedUrlsCallCount = 0;
  chunkRequestsReceived.length = 0;

  const emptyMap1 = await getSignedUrlsForPhotos(mockStorageSupabase, []);
  const emptyMap2 = await getSignedUrlsForPhotos(mockStorageSupabase, null as any);
  const emptyMap3 = await getSignedUrlsForPhotos(mockStorageSupabase, [null, undefined, { storage_path: null }, { storage_path: '' }] as any);

  assert(
    emptyMap1.size === 0 && emptyMap2.size === 0 && emptyMap3.size === 0,
    'Batch Storage Safety: Empty or null/undefined inputs return empty Map',
    `Sizes: ${emptyMap1.size}, ${emptyMap2.size}, ${emptyMap3.size}`
  );
  assert(
    createSignedUrlsCallCount === 0,
    'Batch Storage Network Guard: 0 createSignedUrls calls executed for empty/invalid inputs',
    `Calls made: ${createSignedUrlsCallCount}`
  );

  // Test 3.2: String array, object array, and mixed inputs
  createSignedUrlsCallCount = 0;
  chunkRequestsReceived.length = 0;

  const mixedInputs: StoragePathLike[] = [
    'users/1/photos/a.jpg',
    { storage_path: 'users/1/photos/b.jpg' },
    '/users/1/photos/c.jpg', // Leading slash
    { storage_path: '/users/1/photos/d.jpg' } // Leading slash in object
  ];

  const resultMap = await getSignedUrlsForPhotos(mockStorageSupabase, mixedInputs, 7200, 'memories');

  assert(
    resultMap.size === 4,
    'Batch Storage: Successfully mapped all 4 mixed string/object paths',
    `Map size: ${resultMap.size}`
  );
  assert(
    resultMap.get('users/1/photos/a.jpg')?.includes('token=mock_signed_token_7200') === true,
    'Batch Storage URL Resolution: Correct signed URL and custom 7200s expiry returned for string path'
  );
  assert(
    resultMap.get('users/1/photos/c.jpg')?.includes('token=mock_signed_token_7200') === true,
    'Batch Storage Leading Slash: Stripped leading slash correctly mapped to clean path'
  );

  // Test 3.3: Deduplication
  createSignedUrlsCallCount = 0;
  chunkRequestsReceived.length = 0;

  const duplicateInputs = [
    'users/shared/logo.png',
    'users/shared/logo.png',
    { storage_path: 'users/shared/logo.png' },
    { storage_path: '/users/shared/logo.png' }
  ];

  const dedupMap = await getSignedUrlsForPhotos(mockStorageSupabase, duplicateInputs);

  assert(
    createSignedUrlsCallCount === 1,
    'Batch Storage Deduplication: Exactly 1 storage batch request executed for 4 duplicate entries'
  );
  assert(
    chunkRequestsReceived[0].length === 1 && chunkRequestsReceived[0][0] === 'users/shared/logo.png',
    'Batch Storage Deduplication: Payload sent to Supabase contains exactly 1 unique path',
    `Chunk size: ${chunkRequestsReceived[0]?.length}`
  );
  assert(
    dedupMap.has('users/shared/logo.png'),
    'Batch Storage Deduplication: Result map contains key for deduplicated path'
  );

  // Test 3.4: Batch chunking for large request (> 100 items)
  createSignedUrlsCallCount = 0;
  chunkRequestsReceived.length = 0;

  // Generate 250 distinct synthetic storage paths
  const largeBatch: string[] = [];
  for (let i = 0; i < 250; i++) {
    largeBatch.push(`users/test/batch/img_${i.toString().padStart(4, '0')}.jpg`);
  }

  const largeResultMap = await getSignedUrlsForPhotos(mockStorageSupabase, largeBatch);

  assert(
    largeResultMap.size === 250,
    'Batch Storage Chunking: Successfully generated URLs for all 250 items',
    `Map size: ${largeResultMap.size}`
  );
  assert(
    createSignedUrlsCallCount === 3,
    `Batch Storage Chunking: Split 250 items into exactly 3 chunks (100 + 100 + 50) (actual: ${createSignedUrlsCallCount})`
  );
  assert(
    chunkRequestsReceived[0].length === 100 &&
    chunkRequestsReceived[1].length === 100 &&
    chunkRequestsReceived[2].length === 50,
    'Batch Storage Chunking: Chunk lengths verified as [100, 100, 50]',
    `Lengths: [${chunkRequestsReceived.map(c => c.length).join(', ')}]`
  );

  // Test 3.5: Single helper getSignedUrlForPhoto
  const singleUrl = await getSignedUrlForPhoto(mockStorageSupabase, '/test/single.png', 1800);
  assert(
    singleUrl === 'https://storage.supabase.co/memories/test/single.png?token=single_token_1800',
    'Single Helper: getSignedUrlForPhoto correctly strips leading slash and attaches expiry token'
  );
  const singleNull = await getSignedUrlForPhoto(mockStorageSupabase, '   ');
  assert(
    singleNull === null,
    'Single Helper: getSignedUrlForPhoto returns null for whitespace path'
  );

  // =========================================================================
  // SUITE 4: Direct Next.js Route Integration Tests
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}=== SUITE 4: Next.js API Route Integration (Live Environment) ===${RESET}`);

  // Test importing and executing route handlers with Next.js Request
  try {
    const { GET: searchHandler } = await import('../src/app/api/search/route');
    const { GET: timelineHandler } = await import('../src/app/api/timeline/route');
    const { GET: placesHandler } = await import('../src/app/api/places/route');
    const { GET: photosHandler } = await import('../src/app/api/photos/route');
    const { POST: describeHandler } = await import('../src/app/api/ai/describe/route');

    assert(typeof searchHandler === 'function', 'Route Import: /api/search GET handler loaded successfully');
    assert(typeof timelineHandler === 'function', 'Route Import: /api/timeline GET handler loaded successfully');
    assert(typeof placesHandler === 'function', 'Route Import: /api/places GET handler loaded successfully');
    assert(typeof photosHandler === 'function', 'Route Import: /api/photos GET handler loaded successfully');
    assert(typeof describeHandler === 'function', 'Route Import: /api/ai/describe POST handler loaded successfully');

    // Live search query test via Next.js Request object
    const reqSearch = new Request('http://localhost:3000/api/search?q=test&limit=10');
    const searchRes = await searchHandler(reqSearch);
    assert(searchRes.status === 200, `/api/search returned status 200 (actual: ${searchRes.status})`);
    const searchData = await searchRes.json();
    assert(Array.isArray(searchData.results), `/api/search response body has { results: [] } array structure`);

    // Live timeline test via Next.js Request object
    const timelineRes = await timelineHandler();
    assert(timelineRes.status === 200, `/api/timeline returned status 200 (actual: ${timelineRes.status})`);
    const timelineData = await timelineRes.json();
    assert(Array.isArray(timelineData.timeline), `/api/timeline response body has { timeline: [] } array structure`);

    // Live places test via Next.js Request object
    const placesRes = await placesHandler();
    assert(placesRes.status === 200, `/api/places returned status 200 (actual: ${placesRes.status})`);
    const placesData = await placesRes.json();
    assert(Array.isArray(placesData.places), `/api/places response body has { places: [] } array structure`);

    // Live photos test via Next.js Request object
    const photosRes = await photosHandler(new Request('http://localhost:3000/api/photos'));
    assert(photosRes.status === 200, `/api/photos returned status 200 (actual: ${photosRes.status})`);
    const photosData = await photosRes.json();
    assert(Array.isArray(photosData.photos), `/api/photos response body has { photos: [] } array structure`);

    // Missing photoId error test on /api/ai/describe
    const badDescribeReq = new Request('http://localhost:3000/api/ai/describe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const badDescribeRes = await describeHandler(badDescribeReq);
    assert(
      badDescribeRes.status === 400,
      `/api/ai/describe returns 400 Bad Request when photoId or storagePath missing (actual: ${badDescribeRes.status})`
    );

  } catch (routeErr) {
    console.error('Route execution error:', routeErr);
    assert(false, 'Direct Route Execution: Route handlers executed without uncaught exceptions', String(routeErr));
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`\n${BOLD}${MAGENTA}======================================================================${RESET}`);
  console.log(`${BOLD}CHALLENGER TEST SUMMARY: ${totalTests} Total | ${GREEN}${passedTests} Passed${RESET} | ${failedTests > 0 ? RED : GREEN}${failedTests} Failed${RESET}`);
  console.log(`${BOLD}${MAGENTA}======================================================================${RESET}\n`);

  if (failedTests > 0) {
    console.error(`${RED}FAILURE DETAILS:${RESET}`);
    failureDetails.forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
    process.exit(1);
  } else {
    console.log(`${GREEN}${BOLD}ALL ADVERSARIAL AND EMPIRICAL TESTS PASSED PERFECTLY.${RESET}\n`);
  }
}

runChallengerTestSuite().catch((err) => {
  console.error('Fatal test harness error:', err);
  process.exit(1);
});

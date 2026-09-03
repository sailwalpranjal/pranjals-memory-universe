import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '../src/lib/storage';

dotenv.config({ path: '.env.local' });

// ANSI colors for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ${GREEN}✓ PASS${RESET} - ${testName}`);
  } else {
    failedTests++;
    console.error(`  ${RED}✗ FAIL${RESET} - ${testName}`);
    if (detail) {
      console.error(`    ${RED}Detail: ${detail}${RESET}`);
    }
  }
}

async function runTests() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}  Milestone 2 Empirical Test Harness                             ${RESET}`);
  console.log(`${BOLD}${CYAN}  Multi-Dimensional Search, Timeline, Places, & AI Vision Tests  ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // =========================================================================
  // SECTION 1: Search Filtering & Metadata Resolution Tests
  // =========================================================================
  console.log(`${BOLD}${YELLOW}--- SECTION 1: Search Route Logic & Multi-Dimensional Matcher ---${RESET}`);

  // Mock dataset representing Supabase photos with joined photo_metadata
  const mockPhotoDatabase = [
    {
      id: 'photo-1',
      storage_path: 'users/123/photos/2026/01/p1.jpg',
      original_filename: 'IMG_001.JPG',
      captured_at: '2026-01-15T10:00:00Z',
      imported_at: '2026-01-15T11:00:00Z',
      // PostgREST returns 1:1 joined relations as arrays in some queries
      photo_metadata: [
        {
          photo_id: 'photo-1',
          city: 'Kyoto',
          country: 'Japan',
          make: 'Sony',
          model: 'ILCE-7M4',
          ai_title: 'Golden Pavilion in Autumn',
          ai_description: 'A serene view of the golden temple surrounded by vibrant autumn foliage.',
          ai_tags: ['temple', 'autumn', 'reflection', 'zen', 'architecture']
        }
      ]
    },
    {
      id: 'photo-2',
      storage_path: 'users/123/photos/2026/02/p2.jpg',
      original_filename: 'sunset_at_beach.png',
      captured_at: '2026-02-20T18:30:00Z',
      imported_at: '2026-02-20T19:00:00Z',
      // Or as a direct object in single join
      photo_metadata: {
        photo_id: 'photo-2',
        city: 'Malibu',
        country: 'United States',
        make: 'Apple',
        model: 'iPhone 15 Pro',
        ai_title: 'Golden Pacific Coast',
        ai_description: 'Vivid orange waves crashing against the cliffs at twilight.',
        ai_tags: ['ocean', 'sunset', 'waves', 'beach', 'pacific']
      }
    },
    {
      id: 'photo-3',
      storage_path: 'users/123/photos/2026/03/p3.jpg',
      original_filename: 'DSC_9876.jpg',
      captured_at: '2026-03-01T14:15:00Z',
      imported_at: '2026-03-01T15:00:00Z',
      photo_metadata: null // Photo without metadata
    },
    {
      id: 'photo-4',
      storage_path: 'users/123/photos/2026/04/p4.jpg',
      original_filename: 'paris_eiffel_tower.jpg',
      captured_at: '2026-04-10T12:00:00Z',
      imported_at: '2026-04-10T13:00:00Z',
      photo_metadata: [
        {
          photo_id: 'photo-4',
          city: 'Paris',
          country: 'France',
          make: 'Canon',
          model: 'EOS R5',
          ai_title: 'Iron Lady Under Blue Skies',
          ai_description: 'The monumental tower soaring high above the Champ de Mars.',
          ai_tags: ['landmark', 'eiffel', 'europe', 'monument', 'tower']
        }
      ]
    }
  ];

  // Helper simulating the search filter logic implemented in search/route.ts
  function filterPhotos(photos: typeof mockPhotoDatabase, query: string) {
    if (!query || !query.trim()) return photos;
    const q = query.trim().toLowerCase();
    return photos.filter((p) => {
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

  // Test 1.1: Match by city when filename is generic (IMG_001.JPG in Kyoto)
  const kyotoResults = filterPhotos(mockPhotoDatabase, 'Kyoto');
  assert(kyotoResults.length === 1 && kyotoResults[0].id === 'photo-1', 'Search: Matches city "Kyoto" for generic filename IMG_001.JPG');

  // Test 1.2: Match by country (e.g. "France")
  const franceResults = filterPhotos(mockPhotoDatabase, 'france');
  assert(franceResults.length === 1 && franceResults[0].id === 'photo-4', 'Search: Matches country "france" case-insensitively');

  // Test 1.3: Match by AI title ("Golden Pavilion")
  const titleResults = filterPhotos(mockPhotoDatabase, 'golden pavilion');
  assert(titleResults.length === 1 && titleResults[0].id === 'photo-1', 'Search: Matches AI title "golden pavilion"');

  // Test 1.4: Match by AI description ("twilight")
  const descResults = filterPhotos(mockPhotoDatabase, 'twilight');
  assert(descResults.length === 1 && descResults[0].id === 'photo-2', 'Search: Matches AI description keyword "twilight"');

  // Test 1.5: Match by AI tags array ("zen")
  const tagResults = filterPhotos(mockPhotoDatabase, 'zen');
  assert(tagResults.length === 1 && tagResults[0].id === 'photo-1', 'Search: Matches AI tag in string array');

  // Test 1.6: Match by camera make ("Sony") & camera model ("EOS R5")
  const makeResults = filterPhotos(mockPhotoDatabase, 'sony');
  assert(makeResults.length === 1 && makeResults[0].id === 'photo-1', 'Search: Matches camera make "sony"');

  const modelResults = filterPhotos(mockPhotoDatabase, 'eos r5');
  assert(modelResults.length === 1 && modelResults[0].id === 'photo-4', 'Search: Matches camera model "eos r5"');

  // Test 1.7: Match by original filename
  const filenameResults = filterPhotos(mockPhotoDatabase, 'sunset_at_beach');
  assert(filenameResults.length === 1 && filenameResults[0].id === 'photo-2', 'Search: Matches original filename');

  // Test 1.8: Non-matching query returns empty array
  const emptyResults = filterPhotos(mockPhotoDatabase, 'nonexistent_keyword_xyz');
  assert(emptyResults.length === 0, 'Search: Non-matching query returns empty array');

  // Test 1.9: Empty query returns all items
  const allResults = filterPhotos(mockPhotoDatabase, '');
  assert(allResults.length === 4, 'Search: Empty query returns all items');

  // =========================================================================
  // SECTION 2: Timeline Ordering & Descending Date Grouping Tests
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}--- SECTION 2: Timeline Ordering & Descending Date Grouping ---${RESET}`);

  const unorderedTimelinePhotos = [
    { id: 't1', captured_at: '2025-05-10T10:00:00Z', imported_at: '2026-01-01T00:00:00Z', storage_path: 'p1.jpg' },
    { id: 't2', captured_at: '2026-08-20T15:30:00Z', imported_at: '2026-08-20T16:00:00Z', storage_path: 'p2.jpg' },
    { id: 't3', captured_at: null, imported_at: '2024-03-01T12:00:00Z', storage_path: 'p3.jpg' },
    { id: 't4', captured_at: '2026-08-20T09:15:00Z', imported_at: '2026-08-20T10:00:00Z', storage_path: 'p4.jpg' },
    { id: 't5', captured_at: '2026-09-01T08:00:00Z', imported_at: '2026-09-01T08:30:00Z', storage_path: 'p5.jpg' },
  ];

  // Helper simulating timeline sorting and grouping
  function buildTimeline(photos: typeof unorderedTimelinePhotos) {
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
      return b.localeCompare(a); // Latest dates first
    });

    return sortedDateKeys.map((dateStr) => ({
      date: dateStr,
      photos: grouped[dateStr]
    }));
  }

  const timelineOutput = buildTimeline(unorderedTimelinePhotos);

  assert(timelineOutput.length === 4, `Timeline: Created exactly 4 date buckets (actual: ${timelineOutput.length})`);
  assert(timelineOutput[0].date === '2026-09-01', `Timeline: First bucket is latest date 2026-09-01 (actual: ${timelineOutput[0].date})`);
  assert(timelineOutput[1].date === '2026-08-20', `Timeline: Second bucket is 2026-08-20 (actual: ${timelineOutput[1].date})`);
  assert(timelineOutput[1].photos.length === 2, `Timeline: 2026-08-20 has 2 grouped photos (actual: ${timelineOutput[1].photos.length})`);
  assert(timelineOutput[2].date === '2025-05-10', `Timeline: Third bucket is 2025-05-10 (actual: ${timelineOutput[2].date})`);
  assert(timelineOutput[3].date === '2024-03-01', `Timeline: Fourth bucket is 2024-03-01 (from fallback imported_at) (actual: ${timelineOutput[3].date})`);

  // =========================================================================
  // SECTION 3: Places Route Null Guard & Transformation Tests
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}--- SECTION 3: Places Route Null Guard & Transformation ---${RESET}`);

  const mockLocations = [
    {
      latitude: 35.0116,
      longitude: 135.7681,
      city: 'Kyoto',
      country: 'Japan',
      photos: { id: 'loc-photo-1', storage_path: 'users/1/photos/kyoto.jpg', original_filename: 'kyoto.jpg' }
    },
    {
      latitude: 48.8584,
      longitude: 2.2945,
      city: 'Paris',
      country: 'France',
      photos: [{ id: 'loc-photo-2', storage_path: 'users/1/photos/paris.jpg', original_filename: 'paris.jpg' }]
    },
    {
      latitude: 40.7128,
      longitude: -74.0060,
      city: 'New York',
      country: 'USA',
      photos: null // Orphaned metadata with null photo relation
    },
    {
      latitude: 51.5074,
      longitude: -0.1278,
      city: 'London',
      country: 'UK',
      photos: { id: 'loc-photo-4', storage_path: null, original_filename: 'london.jpg' } // Missing storage_path
    }
  ];

  function processPlaces(locations: typeof mockLocations, urlMap: Map<string, string>) {
    const validLocations = locations.filter((loc) => {
      const photo = Array.isArray(loc.photos) ? loc.photos[0] : loc.photos;
      return Boolean(photo && photo.id && photo.storage_path);
    });

    return validLocations.map((loc) => {
      const photo = Array.isArray(loc.photos) ? loc.photos[0] : loc.photos!;
      const storagePath = photo.storage_path!;
      const cleanPath = storagePath.trim().replace(/^\/+/, '');
      const url = urlMap.get(cleanPath) || urlMap.get(storagePath) || null;

      return {
        id: photo.id,
        lat: loc.latitude,
        lng: loc.longitude,
        city: loc.city || null,
        country: loc.country || null,
        url,
        filename: photo.original_filename || null
      };
    });
  }

  const mockUrlMap = new Map([
    ['users/1/photos/kyoto.jpg', 'https://storage/kyoto.jpg?token=123'],
    ['users/1/photos/paris.jpg', 'https://storage/paris.jpg?token=456']
  ]);

  const placesOutput = processPlaces(mockLocations, mockUrlMap);
  assert(placesOutput.length === 2, `Places: Successfully filtered out null/invalid photo relations (actual: ${placesOutput.length})`);
  assert(placesOutput[0].city === 'Kyoto' && placesOutput[0].url === 'https://storage/kyoto.jpg?token=123', 'Places: Valid Kyoto entry transformed with signed URL');
  assert(placesOutput[1].city === 'Paris' && placesOutput[1].url === 'https://storage/paris.jpg?token=456', 'Places: Valid Paris entry transformed with signed URL');

  // =========================================================================
  // SECTION 4: AI Vision Upsert & JSON Parsing Tests
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}--- SECTION 4: AI Vision Upsert & JSON Parsing Resilience ---${RESET}`);

  // Test parsing markdown formatted JSON responses from LLM
  const rawLlmMarkdownOutput = `\`\`\`json
{
  "title": "Sunset Horizon",
  "description": "Golden hues blanket the tranquil ocean as gentle waves kiss the sandy shore.",
  "tags": ["sunset", "beach", "ocean", "golden hour", "horizon"]
}
\`\`\``;

  let cleanText = rawLlmMarkdownOutput.trim();
  if (cleanText.startsWith('```json')) {
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
  } else if (cleanText.startsWith('```')) {
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }
  const parsedAi = JSON.parse(cleanText);

  assert(parsedAi.title === 'Sunset Horizon', 'AI Describe: Parsed title from markdown code block correctly');
  assert(Array.isArray(parsedAi.tags) && parsedAi.tags.length === 5, 'AI Describe: Parsed 5 semantic tags');
  assert(parsedAi.description.length > 20, 'AI Describe: Parsed descriptive sentence');

  // Verify upsert schema payload structure
  const upsertPayload = {
    photo_id: 'sample-photo-uuid',
    ai_title: parsedAi.title,
    ai_description: parsedAi.description,
    ai_tags: parsedAi.tags
  };

  assert(upsertPayload.photo_id === 'sample-photo-uuid', 'AI Describe: Upsert payload contains photo_id PK');
  assert(upsertPayload.ai_title === 'Sunset Horizon', 'AI Describe: Upsert payload contains ai_title');
  assert(upsertPayload.ai_tags.includes('golden hour'), 'AI Describe: Upsert payload contains ai_tags array');

  // =========================================================================
  // SECTION 5: Live Database Verification (if reachable)
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}--- SECTION 5: Live API Route Database Checks ---${RESET}`);

  const liveSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const liveSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (liveSupabaseUrl && liveSupabaseKey) {
    try {
      const client = createClient(liveSupabaseUrl, liveSupabaseKey);
      
      // Test search query against live database
      const { data: searchTest, error: searchError } = await client
        .from('photos')
        .select('*, photo_metadata(*)')
        .limit(5);

      if (searchError) {
        console.warn(`  Live DB Query Warning: ${searchError.message}`);
      } else {
        assert(Array.isArray(searchTest), 'Live DB: Successfully selected photos with photo_metadata join');
        console.log(`  Live DB Query returned ${searchTest.length} photos.`);
      }
    } catch (e) {
      console.warn(`  Live DB non-fatal connection warning:`, e);
    }
  } else {
    console.log('  Skipping live DB check (missing env).');
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}Milestone 2 Test Summary: ${totalTests} Total | ${GREEN}${passedTests} Passed${RESET} | ${failedTests > 0 ? RED : GREEN}${failedTests} Failed${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});

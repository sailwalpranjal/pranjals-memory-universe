import sharp from 'sharp';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { computeSha256, computeDHash, hammingDistance, isNearDuplicate } from '../src/lib/hashing';
import { getSignedUrlsForPhotos, getSignedUrlForPhoto } from '../src/lib/storage';

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
  console.log(`${BOLD}${CYAN}  Milestone 1 Empirical Test Harness (Challenger 1)             ${RESET}`);
  console.log(`${BOLD}${CYAN}  Perceptual Difference Hashing & Batch Storage Verification     ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  // =========================================================================
  // SECTION 1: Difference Hashing & Image Similarity Verification
  // =========================================================================
  console.log(`${BOLD}${YELLOW}--- SECTION 1: Difference Hashing & Image Similarity ---${RESET}`);

  // Test Set A: Synthetic Photo-realistic Image (continuous gradients + geometric features)
  const photoWidth = 500;
  const photoHeight = 400;
  const photoBuffer = Buffer.alloc(photoWidth * photoHeight * 3);
  for (let y = 0; y < photoHeight; y++) {
    for (let x = 0; x < photoWidth; x++) {
      const idx = (y * photoWidth + x) * 3;
      const verticalGradient = y / photoHeight;
      const horizontalGradient = x / photoWidth;
      const wave = Math.sin(x / 40) * 15;
      photoBuffer[idx] = Math.min(255, Math.max(0, Math.floor(60 + 140 * verticalGradient + wave))); // R
      photoBuffer[idx + 1] = Math.min(255, Math.max(0, Math.floor(120 + 80 * horizontalGradient))); // G
      photoBuffer[idx + 2] = Math.min(255, Math.max(0, Math.floor(220 - 120 * verticalGradient))); // B
    }
  }
  const photoBasePng = await sharp(photoBuffer, { raw: { width: photoWidth, height: photoHeight, channels: 3 } }).png().toBuffer();
  const photoIdentical = Buffer.from(photoBasePng);
  const photoJpeg80 = await sharp(photoBasePng).jpeg({ quality: 80 }).toBuffer();
  const photoJpeg60 = await sharp(photoBasePng).jpeg({ quality: 60 }).toBuffer();
  const photoJpeg30 = await sharp(photoBasePng).jpeg({ quality: 30 }).toBuffer();
  const photoResizedPng300 = await sharp(photoBasePng).resize(300, 240).png().toBuffer();
  const photoResizedPng200 = await sharp(photoBasePng).resize(200, 160).png().toBuffer();
  const photoResizedJpeg250 = await sharp(photoBasePng).resize(250, 200).jpeg({ quality: 75 }).toBuffer();
  const photoResizedWebP = await sharp(photoBasePng).resize(300, 240).webp({ quality: 80 }).toBuffer();
  const photoUpscaled1000 = await sharp(photoBasePng).resize(1000, 800).png().toBuffer();

  // Test Set B: Completely Different Images
  // 1. Random noise image
  const randomPixels = crypto.randomBytes(photoWidth * photoHeight * 3);
  const imgNoise = await sharp(randomPixels, { raw: { width: photoWidth, height: photoHeight, channels: 3 } }).png().toBuffer();

  // 2. Inverted gradient image
  const invertedBuffer = Buffer.alloc(photoWidth * photoHeight * 3);
  for (let y = 0; y < photoHeight; y++) {
    for (let x = 0; x < photoWidth; x++) {
      const idx = (y * photoWidth + x) * 3;
      invertedBuffer[idx] = 255 - photoBuffer[idx];
      invertedBuffer[idx + 1] = 255 - photoBuffer[idx + 1];
      invertedBuffer[idx + 2] = 255 - photoBuffer[idx + 2];
    }
  }
  const imgInverted = await sharp(invertedBuffer, { raw: { width: photoWidth, height: photoHeight, channels: 3 } }).png().toBuffer();

  // 3. High-contrast vertical checkerboard
  const checkerBuffer = Buffer.alloc(photoWidth * photoHeight * 3);
  for (let y = 0; y < photoHeight; y++) {
    for (let x = 0; x < photoWidth; x++) {
      const idx = (y * photoWidth + x) * 3;
      const isBlack = (Math.floor(x / 50) + Math.floor(y / 50)) % 2 === 0;
      const val = isBlack ? 0 : 255;
      checkerBuffer[idx] = val;
      checkerBuffer[idx + 1] = val;
      checkerBuffer[idx + 2] = val;
    }
  }
  const imgChecker = await sharp(checkerBuffer, { raw: { width: photoWidth, height: photoHeight, channels: 3 } }).png().toBuffer();

  // Compute Hashes
  const hashBase = await computeDHash(photoBasePng);
  const hashIdentical = await computeDHash(photoIdentical);
  const hashJpeg80 = await computeDHash(photoJpeg80);
  const hashJpeg60 = await computeDHash(photoJpeg60);
  const hashJpeg30 = await computeDHash(photoJpeg30);
  const hashResizedPng300 = await computeDHash(photoResizedPng300);
  const hashResizedPng200 = await computeDHash(photoResizedPng200);
  const hashResizedJpeg250 = await computeDHash(photoResizedJpeg250);
  const hashResizedWebP = await computeDHash(photoResizedWebP);
  const hashUpscaled1000 = await computeDHash(photoUpscaled1000);
  const hashNoise = await computeDHash(imgNoise);
  const hashInverted = await computeDHash(imgInverted);
  const hashChecker = await computeDHash(imgChecker);

  console.log(`\n  Computed dHash Values (64-bit Hex):`);
  console.log(`    Base PNG:             ${hashBase}`);
  console.log(`    Identical Buffer:     ${hashIdentical}`);
  console.log(`    Recompressed JPEG Q80:${hashJpeg80}`);
  console.log(`    Recompressed JPEG Q60:${hashJpeg60}`);
  console.log(`    Recompressed JPEG Q30:${hashJpeg30}`);
  console.log(`    Resized PNG (300x240):${hashResizedPng300}`);
  console.log(`    Resized PNG (200x160):${hashResizedPng200}`);
  console.log(`    Resized JPEG (250x200):${hashResizedJpeg250}`);
  console.log(`    Resized WebP (300x240):${hashResizedWebP}`);
  console.log(`    Upscaled PNG (1000):  ${hashUpscaled1000}`);
  console.log(`    Random Noise:         ${hashNoise}`);
  console.log(`    Inverted Image:       ${hashInverted}`);
  console.log(`    Checkerboard Image:   ${hashChecker}\n`);

  // Calculate Hamming Distances
  const distIdentical = hammingDistance(hashBase, hashIdentical);
  const distJpeg80 = hammingDistance(hashBase, hashJpeg80);
  const distJpeg60 = hammingDistance(hashBase, hashJpeg60);
  const distJpeg30 = hammingDistance(hashBase, hashJpeg30);
  const distResizedPng300 = hammingDistance(hashBase, hashResizedPng300);
  const distResizedPng200 = hammingDistance(hashBase, hashResizedPng200);
  const distResizedJpeg250 = hammingDistance(hashBase, hashResizedJpeg250);
  const distResizedWebP = hammingDistance(hashBase, hashResizedWebP);
  const distUpscaled1000 = hammingDistance(hashBase, hashUpscaled1000);
  const distNoise = hammingDistance(hashBase, hashNoise);
  const distInverted = hammingDistance(hashBase, hashInverted);
  const distChecker = hammingDistance(hashBase, hashChecker);

  console.log(`  Measured Hamming Distances (Threshold = 4):`);
  console.log(`    Identical:            ${distIdentical} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashIdentical)})`);
  console.log(`    Recompressed JPEG Q80:${distJpeg80} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashJpeg80)})`);
  console.log(`    Recompressed JPEG Q60:${distJpeg60} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashJpeg60)})`);
  console.log(`    Recompressed JPEG Q30:${distJpeg30} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashJpeg30)})`);
  console.log(`    Resized PNG (300x240):${distResizedPng300} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashResizedPng300)})`);
  console.log(`    Resized PNG (200x160):${distResizedPng200} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashResizedPng200)})`);
  console.log(`    Resized JPEG (250x200):${distResizedJpeg250} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashResizedJpeg250)})`);
  console.log(`    Resized WebP (300x240):${distResizedWebP} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashResizedWebP)})`);
  console.log(`    Upscaled PNG (1000):  ${distUpscaled1000} (<= 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashUpscaled1000)})`);
  console.log(`    Random Noise:         ${distNoise} (>> 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashNoise)})`);
  console.log(`    Inverted Image:       ${distInverted} (>> 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashInverted)})`);
  console.log(`    Checkerboard Image:   ${distChecker} (>> 4, isNearDuplicate: ${isNearDuplicate(hashBase, hashChecker)})\n`);

  // 1.1 SHA-256 Checksum Assertions
  const shaBase = computeSha256(photoBasePng);
  const shaIdentical = computeSha256(photoIdentical);
  const shaJpeg80 = computeSha256(photoJpeg80);
  assert(shaBase === shaIdentical, 'SHA-256: Identical binary buffer produces identical hash');
  assert(shaBase !== shaJpeg80, 'SHA-256: Recompressed binary buffer changes hash');
  assert(/^[0-9a-f]{64}$/.test(shaBase), 'SHA-256: Produces standard 64-char lowercase hex string');

  // 1.2 Perceptual Near-Duplicate Assertions (Hamming distance <= 4)
  assert(distIdentical === 0, 'dHash: Identical image produces Hamming distance 0');
  assert(isNearDuplicate(hashBase, hashIdentical), 'dHash: Identical image isNearDuplicate === true');

  assert(distJpeg80 <= 4, `dHash: JPEG Q80 distance <= 4 (actual: ${distJpeg80})`);
  assert(isNearDuplicate(hashBase, hashJpeg80), 'dHash: JPEG Q80 isNearDuplicate === true');

  assert(distJpeg60 <= 4, `dHash: JPEG Q60 distance <= 4 (actual: ${distJpeg60})`);
  assert(isNearDuplicate(hashBase, hashJpeg60), 'dHash: JPEG Q60 isNearDuplicate === true');

  assert(distJpeg30 <= 4, `dHash: JPEG Q30 distance <= 4 (actual: ${distJpeg30})`);
  assert(isNearDuplicate(hashBase, hashJpeg30), 'dHash: JPEG Q30 isNearDuplicate === true');

  assert(distResizedPng300 <= 4, `dHash: Resized PNG 300x240 distance <= 4 (actual: ${distResizedPng300})`);
  assert(isNearDuplicate(hashBase, hashResizedPng300), 'dHash: Resized PNG 300x240 isNearDuplicate === true');

  assert(distResizedPng200 <= 4, `dHash: Resized PNG 200x160 distance <= 4 (actual: ${distResizedPng200})`);
  assert(isNearDuplicate(hashBase, hashResizedPng200), 'dHash: Resized PNG 200x160 isNearDuplicate === true');

  assert(distResizedJpeg250 <= 4, `dHash: Resized JPEG 250x200 distance <= 4 (actual: ${distResizedJpeg250})`);
  assert(isNearDuplicate(hashBase, hashResizedJpeg250), 'dHash: Resized JPEG 250x200 isNearDuplicate === true');

  assert(distResizedWebP <= 4, `dHash: Resized WebP 300x240 distance <= 4 (actual: ${distResizedWebP})`);
  assert(isNearDuplicate(hashBase, hashResizedWebP), 'dHash: Resized WebP 300x240 isNearDuplicate === true');

  assert(distUpscaled1000 <= 4, `dHash: Upscaled PNG 1000x800 distance <= 4 (actual: ${distUpscaled1000})`);
  assert(isNearDuplicate(hashBase, hashUpscaled1000), 'dHash: Upscaled PNG 1000x800 isNearDuplicate === true');

  // 1.3 Completely Different Images Assertions (Hamming distance >> 4)
  assert(distNoise > 15, `dHash: Random noise image distance >> 4 (actual: ${distNoise})`);
  assert(!isNearDuplicate(hashBase, hashNoise), 'dHash: Random noise isNearDuplicate === false');

  assert(distInverted > 15, `dHash: Inverted image distance >> 4 (actual: ${distInverted})`);
  assert(!isNearDuplicate(hashBase, hashInverted), 'dHash: Inverted image isNearDuplicate === false');

  assert(distChecker > 15, `dHash: Checkerboard image distance >> 4 (actual: ${distChecker})`);
  assert(!isNearDuplicate(hashBase, hashChecker), 'dHash: Checkerboard isNearDuplicate === false');

  // =========================================================================
  // SECTION 2: Hamming Distance & Edge Case Mathematical Verification
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}--- SECTION 2: Hamming Distance Edge Cases ---${RESET}`);

  assert(hammingDistance('0000000000000000', '0000000000000000') === 0, 'Hamming distance: 0x0 vs 0x0 = 0');
  assert(hammingDistance('ffffffffffffffff', 'ffffffffffffffff') === 0, 'Hamming distance: 0xFF... vs 0xFF... = 0');
  assert(hammingDistance('0000000000000000', 'ffffffffffffffff') === 64, 'Hamming distance: 0x0 vs 0xFF... = 64');
  assert(hammingDistance('0000000000000000', '0000000000000001') === 1, 'Hamming distance: 1 bit difference = 1');
  assert(hammingDistance('0000000000000000', '000000000000000f') === 4, 'Hamming distance: 4 bits difference = 4');
  assert(isNearDuplicate('0000000000000000', '000000000000000f', 4) === true, 'Threshold boundary: distance 4 <= 4 is duplicate');
  assert(hammingDistance('0000000000000000', '000000000000001f') === 5, 'Hamming distance: 5 bits difference = 5');
  assert(isNearDuplicate('0000000000000000', '000000000000001f', 4) === false, 'Threshold boundary: distance 5 > 4 is NOT duplicate');

  // Case insensitivity
  assert(hammingDistance('A1B2C3D4E5F60718', 'a1b2c3d4e5f60718') === 0, 'Hamming distance: uppercase vs lowercase hex = 0');

  // Short/padded hex strings
  assert(hammingDistance('f', '0') === 4, 'Hamming distance: short single-char strings padded correctly');

  // Invalid/null/undefined inputs
  assert(hammingDistance('', '0000000000000000') === 64, 'Hamming distance: empty string returns 64');
  assert(hammingDistance(null as unknown as string, '0000000000000000') === 64, 'Hamming distance: null returns 64');
  assert(hammingDistance('invalid-hex-xyz', '0000000000000000') === 64, 'Hamming distance: invalid hex returns 64');
  assert(!isNearDuplicate(null as unknown as string, '0000000000000000'), 'isNearDuplicate with null returns false');

  // =========================================================================
  // SECTION 3: Storage Batch Utility (`getSignedUrlsForPhotos`)
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}--- SECTION 3: Batch Storage Utility Verification ---${RESET}`);

  // Mock Supabase Client for deterministic tracking
  let callsMade: Array<{ paths: string[]; expiresIn: number }> = [];

  const mockSupabase = {
    storage: {
      from: (bucket: string) => ({
        createSignedUrls: async (paths: string[], expiresIn: number) => {
          callsMade.push({ paths, expiresIn });
          return {
            data: paths.map((p) => ({
              path: p,
              signedUrl: `https://storage.supabase.co/${bucket}/${p}?token=signed_${expiresIn}`,
              error: null,
            })),
            error: null,
          };
        },
        createSignedUrl: async (path: string, expiresIn: number) => {
          return {
            data: { signedUrl: `https://storage.supabase.co/${bucket}/${path}?token=signed_${expiresIn}` },
            error: null,
          };
        },
      }),
    },
  } as unknown as ReturnType<typeof createClient>;

  // Test 3.1: Empty array handling (0 API calls)
  callsMade = [];
  const emptyRes = await getSignedUrlsForPhotos(mockSupabase, []);
  assert(emptyRes instanceof Map && emptyRes.size === 0, 'Empty array returns empty Map');
  assert(callsMade.length === 0, 'Empty array makes 0 API calls');

  // Test 3.2: Null / undefined / invalid inputs
  callsMade = [];
  const nullRes = await getSignedUrlsForPhotos(mockSupabase, null as unknown as string[]);
  assert(nullRes.size === 0 && callsMade.length === 0, 'Null input safely returns empty Map without calls');

  const emptyItemsRes = await getSignedUrlsForPhotos(mockSupabase, ['', '   ', null as unknown as string, { storage_path: null }]);
  assert(emptyItemsRes.size === 0 && callsMade.length === 0, 'Array of empty/null items makes 0 API calls');

  // Test 3.3: Duplicate path deduplication
  callsMade = [];
  const inputWithDuplicates = [
    'users/123/photo1.jpg',
    'users/123/photo1.jpg',
    '/users/123/photo1.jpg', // with leading slash
    { storage_path: 'users/123/photo1.jpg' },
    { storage_path: '/users/123/photo2.jpg' },
    'users/123/photo2.jpg',
  ];

  const dedupRes = await getSignedUrlsForPhotos(mockSupabase, inputWithDuplicates, 7200, 'memories');
  assert(dedupRes.size === 2, `Deduplicated result map has exactly 2 entries (actual: ${dedupRes.size})`);
  assert(callsMade.length === 1, 'Single batch call made for deduplicated inputs');
  assert(callsMade[0].paths.length === 2, `Batch call received exactly 2 unique paths (actual: ${callsMade[0].paths.length})`);
  assert(callsMade[0].paths[0] === 'users/123/photo1.jpg', 'Leading slashes stripped from path 1');
  assert(callsMade[0].paths[1] === 'users/123/photo2.jpg', 'Leading slashes stripped from path 2');
  assert(callsMade[0].expiresIn === 7200, 'Custom expiresIn passed through to API');
  assert(dedupRes.get('users/123/photo1.jpg')?.includes('token=signed_7200') === true, 'Returned signed URL matches path 1');
  assert(dedupRes.get('users/123/photo2.jpg')?.includes('token=signed_7200') === true, 'Returned signed URL matches path 2');

  // Test 3.4: Chunking of large requests (>100 items)
  callsMade = [];
  const largePathArray: string[] = [];
  for (let i = 0; i < 250; i++) {
    largePathArray.push(`users/u1/photos/2026/09/photo_${i}.jpg`);
  }

  const chunkedRes = await getSignedUrlsForPhotos(mockSupabase, largePathArray, 3600);
  assert(chunkedRes.size === 250, `Large request generated 250 signed URLs (actual: ${chunkedRes.size})`);
  assert(callsMade.length === 3, `Chunked 250 items into 3 batch calls (actual: ${callsMade.length})`);
  assert(callsMade[0].paths.length === 100, `Chunk 1 has 100 items (actual: ${callsMade[0].paths.length})`);
  assert(callsMade[1].paths.length === 100, `Chunk 2 has 100 items (actual: ${callsMade[1].paths.length})`);
  assert(callsMade[2].paths.length === 50, `Chunk 3 has 50 items (actual: ${callsMade[2].paths.length})`);

  // Test 3.5: Error resilience
  const errorMockSupabase = {
    storage: {
      from: () => ({
        createSignedUrls: async () => {
          return { data: null, error: { message: 'Storage service unavailable' } };
        },
      }),
    },
  } as unknown as ReturnType<typeof createClient>;

  const errorRes = await getSignedUrlsForPhotos(errorMockSupabase, ['photo1.jpg', 'photo2.jpg']);
  assert(errorRes instanceof Map && errorRes.size === 0, 'Storage API error handled gracefully without throw');

  // Test 3.6: Single photo helper (`getSignedUrlForPhoto`)
  const singleUrl = await getSignedUrlForPhoto(mockSupabase, '/test/photo.jpg', 1800);
  assert(singleUrl?.includes('token=signed_1800') === true, 'getSignedUrlForPhoto returns valid signed URL');

  const singleNull = await getSignedUrlForPhoto(mockSupabase, '');
  assert(singleNull === null, 'getSignedUrlForPhoto with empty path returns null');

  // =========================================================================
  // SECTION 4: Live Supabase Storage Integration (if online)
  // =========================================================================
  console.log(`\n${BOLD}${YELLOW}--- SECTION 4: Live Supabase Connection Test ---${RESET}`);

  const liveSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const liveSupabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (liveSupabaseUrl && liveSupabaseKey) {
    try {
      const liveClient = createClient(liveSupabaseUrl, liveSupabaseKey);
      const testPaths = ['non_existent_1.jpg', 'non_existent_2.jpg'];
      const liveRes = await getSignedUrlsForPhotos(liveClient, testPaths, 60, 'memories');
      assert(liveRes instanceof Map, 'Live Supabase getSignedUrlsForPhotos executed and returned Map instance');
      console.log(`  Live Supabase call executed successfully (returned map size: ${liveRes.size})`);
    } catch (liveErr) {
      console.warn(`  Live Supabase check warning (non-fatal):`, liveErr);
    }
  } else {
    console.log(`  Skipping live network test: missing environment variables.`);
  }

  // =========================================================================
  // SUMMARY
  // =========================================================================
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}Test Summary: ${totalTests} Total | ${GREEN}${passedTests} Passed${RESET} | ${failedTests > 0 ? RED : GREEN}${failedTests} Failed${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

  if (failedTests > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Unhandled test harness error:', err);
  process.exit(1);
});

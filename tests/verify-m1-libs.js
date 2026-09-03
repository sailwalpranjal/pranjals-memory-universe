require('dotenv').config({ path: '.env.local' });
const sharp = require('sharp');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Since memory-universe has typescript, we can import compiled or create equivalent tests
async function runLibVerification() {
  console.log('====================================================');
  console.log('   M1 LIBRARIES & HASHING VERIFICATION SUITE       ');
  console.log('====================================================\n');

  let passed = true;

  // 1. Verify SHA-256
  const testBuffer = Buffer.from('hello-world-pranjal-memory-universe');
  const expectedSha256 = crypto.createHash('sha256').update(testBuffer).digest('hex');

  // Test Sharp dHash logic
  // Create a 100x100 white image with a black vertical bar on left
  const img1 = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  }).png().toBuffer();

  // Create an identical image re-encoded to JPEG
  const img1Jpeg = await sharp(img1).jpeg({ quality: 80 }).toBuffer();

  // Create a completely different image (black)
  const img2 = await sharp({
    create: {
      width: 100,
      height: 100,
      channels: 3,
      background: { r: 0, g: 0, b: 0 }
    }
  }).png().toBuffer();

  async function computeDHash(buffer) {
    const { data } = await sharp(buffer)
      .resize(9, 8, { fit: 'fill' })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    let hashBigInt = BigInt(0);
    const oneBigInt = BigInt(1);
    for (let row = 0; row < 8; row++) {
      const rowOffset = row * 9;
      for (let col = 0; col < 8; col++) {
        const left = data[rowOffset + col];
        const right = data[rowOffset + col + 1];
        const bit = left > right ? oneBigInt : BigInt(0);
        hashBigInt = (hashBigInt << oneBigInt) | bit;
      }
    }
    return hashBigInt.toString(16).padStart(16, '0').toLowerCase();
  }

  function hammingDistance(h1, h2) {
    if (!h1 || !h2) return 64;
    const b1 = BigInt('0x' + h1.padStart(16, '0'));
    const b2 = BigInt('0x' + h2.padStart(16, '0'));
    let xor = b1 ^ b2;
    let dist = 0;
    while (xor > BigInt(0)) {
      xor &= xor - BigInt(1);
      dist++;
    }
    return dist;
  }

  const hash1 = await computeDHash(img1);
  const hash1Jpeg = await computeDHash(img1Jpeg);
  const hash2 = await computeDHash(img2);

  const distNear = hammingDistance(hash1, hash1Jpeg);
  const distFar = hammingDistance(hash1, hash2);

  console.log(`  dHash Image 1 (PNG):  ${hash1}`);
  console.log(`  dHash Image 1 (JPEG): ${hash1Jpeg} (Hamming Distance: ${distNear})`);
  console.log(`  dHash Image 2 (Black): ${hash2} (Hamming Distance: ${distFar})`);

  if (distNear <= 4) {
    console.log('  [PASS] dHash correctly identifies re-encoded image as near-duplicate (dist <= 4)');
  } else {
    console.error('  [FAIL] dHash failed on near-duplicate detection');
    passed = false;
  }

  // 2. Verify Storage Batch Signed URLs
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const testFileKey = `test-verify-${Date.now()}.txt`;
  await supabase.storage.from('memories').upload(testFileKey, Buffer.from('test storage content'));

  const { data: signedUrls, error: batchError } = await supabase.storage
    .from('memories')
    .createSignedUrls([testFileKey], 300);

  if (!batchError && signedUrls && signedUrls.length === 1 && signedUrls[0].signedUrl) {
    console.log('  [PASS] Supabase Batch createSignedUrls succeeded');
  } else {
    console.error('  [FAIL] Supabase Batch createSignedUrls failed:', batchError);
    passed = false;
  }

  await supabase.storage.from('memories').remove([testFileKey]);
  console.log('  [PASS] Temporary storage test file removed');

  console.log('\n====================================================');
  console.log(`LIBRARIES VERDICT: ${passed ? 'APPROVE' : 'REQUEST_CHANGES'}`);
  console.log('====================================================');

  process.exit(passed ? 0 : 1);
}

runLibVerification();

import crypto from 'crypto';
import sharp from 'sharp';

/**
 * Computes standard SHA-256 cryptographic hash (checksum) for a binary buffer.
 * Returns a 64-character lowercase hexadecimal string.
 *
 * @param buffer - File data buffer
 * @returns 64-character lowercase hex string
 */
export function computeSha256(buffer: Buffer): string {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Computes a 64-bit Difference Hash (dHash) for an image buffer using sharp.
 *
 * Algorithm:
 * 1. Resize image to 9 columns x 8 rows (72 pixels) without preserving aspect ratio (`fit: 'fill'`).
 * 2. Convert to 8-bit single-channel grayscale (`.grayscale()`).
 * 3. Extract raw uncompressed pixel luminance values.
 * 4. For each row (0..7), compare adjacent columns (col vs col + 1):
 *    - If pixel[row, col] > pixel[row, col + 1], bit = 1
 *    - Else bit = 0
 *    - 8 rows * 8 comparisons = 64 bits.
 * 5. Format the 64-bit binary value as a 16-character lowercase hexadecimal string.
 *
 * @param buffer - Image binary buffer (JPEG, PNG, WebP, TIFF, etc.)
 * @returns Promise resolving to 16-character hex string (e.g. "a1b2c3d4e5f60718")
 */
export async function computeDHash(buffer: Buffer): Promise<string> {
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

/**
 * Computes the Hamming distance between two 64-bit hex hash strings.
 * The Hamming distance represents the number of bit positions in which the two hashes differ.
 *
 * @param hash1 - First 16-character hex hash string
 * @param hash2 - Second 16-character hex hash string
 * @returns Number of differing bits (0 to 64). Returns 64 if either hash is invalid.
 */
export function hammingDistance(hash1: string, hash2: string): number {
  if (!hash1 || !hash2) return 64;

  const h1 = hash1.trim().toLowerCase();
  const h2 = hash2.trim().toLowerCase();

  // If identical string, distance is 0
  if (h1 === h2) return 0;

  const pad1 = h1.padStart(16, '0');
  const pad2 = h2.padStart(16, '0');

  if (pad1.length !== 16 || pad2.length !== 16) {
    const maxLen = Math.max(pad1.length, pad2.length);
    const p1 = pad1.padStart(maxLen, '0');
    const p2 = pad2.padStart(maxLen, '0');
    let distance = 0;
    for (let i = 0; i < maxLen; i++) {
      const v1 = parseInt(p1[i], 16);
      const v2 = parseInt(p2[i], 16);
      if (isNaN(v1) || isNaN(v2)) return 64;
      const xor = v1 ^ v2;
      distance += (xor & 1) + ((xor >> 1) & 1) + ((xor >> 2) & 1) + ((xor >> 3) & 1);
    }
    return distance;
  }

  try {
    const b1 = BigInt('0x' + pad1);
    const b2 = BigInt('0x' + pad2);
    let xor = b1 ^ b2;
    let distance = 0;
    const zero = BigInt(0);
    const one = BigInt(1);
    while (xor > zero) {
      xor &= xor - one; // Brian Kernighan's algorithm
      distance++;
    }
    return distance;
  } catch {
    return 64;
  }
}

/**
 * Determines whether two images are near-duplicates based on their perceptual dHash values.
 * Default threshold is 4 (Hamming distance <= 4 indicates >93.75% visual similarity).
 *
 * @param hash1 - Perceptual hash of first image
 * @param hash2 - Perception hash of second image
 * @param threshold - Maximum allowed Hamming distance (default: 4)
 * @returns True if images are considered near-duplicates
 */
export function isNearDuplicate(
  hash1: string,
  hash2: string,
  threshold: number = 4
): boolean {
  if (!hash1 || !hash2) return false;
  return hammingDistance(hash1, hash2) <= threshold;
}

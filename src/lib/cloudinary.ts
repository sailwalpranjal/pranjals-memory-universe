import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary with server-side environment variables
export const CLOUDINARY_CONFIG = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'Images',
  api_key: process.env.CLOUDINARY_API_KEY || '',
  api_secret: process.env.CLOUDINARY_API_SECRET || '',
  secure: true,
};

cloudinary.config(CLOUDINARY_CONFIG);

export const PRANJAL_FOLDER = 'pranjal_universe';
export const PRANJAL_PREFIX = 'pranjal_universe_';
export const PRANJAL_TAG = 'pranjal_universe';

/**
 * Validates that an asset follows the strict Pranjal's Universe naming convention.
 * If an asset in the Cloudinary bucket does NOT follow this naming convention,
 * it is filtered out and will NOT be displayed.
 */
export function isPranjalUniverseImage(publicId: string, tags?: string[]): boolean {
  if (!publicId) return false;
  
  // Strict prefix check: must be in folder pranjal_universe/ with prefix pranjal_universe_
  const isInFolder = publicId.startsWith(`${PRANJAL_FOLDER}/${PRANJAL_PREFIX}`);
  const hasPrefix = publicId.startsWith(PRANJAL_PREFIX);
  const hasTag = Array.isArray(tags) && tags.includes(PRANJAL_TAG);

  return isInFolder || hasPrefix || hasTag;
}

/**
 * Upload an image buffer directly to Cloudinary using the strict naming convention.
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  filename?: string
): Promise<{
  url: string;
  publicId: string;
  width?: number;
  height?: number;
  format?: string;
  bytes?: number;
} | null> {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const cleanName = filename
    ? filename.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20)
    : 'capture';

  // Strict public ID following the naming convention
  const publicId = `${PRANJAL_FOLDER}/${PRANJAL_PREFIX}${timestamp}_${cleanName}_${randomSuffix}`;

  return new Promise((resolve) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        public_id: publicId,
        folder: PRANJAL_FOLDER,
        tags: [PRANJAL_TAG, 'memory', 'pranjal'],
        resource_type: 'auto',
        overwrite: false,
      },
      (error, result?: UploadApiResponse) => {
        if (error) {
          console.warn('[cloudinary] Upload error:', error.message);
          resolve(null);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            width: result.width,
            height: result.height,
            format: result.format,
            bytes: result.bytes,
          });
        } else {
          resolve(null);
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Ping Cloudinary to verify credentials and connectivity.
 */
export async function testCloudinaryConnection(cloudNameOverride?: string): Promise<{
  success: boolean;
  message: string;
  cloudName: string;
}> {
  const cloudName = cloudNameOverride || CLOUDINARY_CONFIG.cloud_name;
  try {
    const result = await cloudinary.api.ping({
      cloud_name: cloudName,
      api_key: CLOUDINARY_CONFIG.api_key,
      api_secret: CLOUDINARY_CONFIG.api_secret,
    });
    return {
      success: result.status === 'ok',
      message: result.status === 'ok' ? 'Cloudinary connection verified successfully!' : 'Ping returned non-OK status',
      cloudName,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown Cloudinary error';
    return {
      success: false,
      message: msg,
      cloudName,
    };
  }
}

/**
 * List all assets in Cloudinary strictly matching the Pranjal's Universe convention.
 * Any other images uploaded to Cloudinary that do not follow the convention are ignored.
 */
export async function listPranjalUniverseAssets(maxResults = 100) {
  try {
    const result = await cloudinary.api.resources_by_tag(PRANJAL_TAG, {
      max_results: maxResults,
      direction: 'desc',
    });

    const assets = (result.resources || []).filter((item: { public_id: string; tags?: string[] }) =>
      isPranjalUniverseImage(item.public_id, item.tags)
    );

    return assets;
  } catch (err) {
    console.warn('[cloudinary] Error listing assets:', err);
    return [];
  }
}

/**
 * Delete an asset from Cloudinary by public ID (only if it matches the naming convention).
 */
export async function deleteFromCloudinary(publicId: string): Promise<boolean> {
  if (!isPranjalUniverseImage(publicId)) {
    console.warn('[cloudinary] Refusing to delete asset that does not match naming convention:', publicId);
    return false;
  }
  try {
    const res = await cloudinary.uploader.destroy(publicId);
    return res.result === 'ok';
  } catch (err) {
    console.error('[cloudinary] Failed to delete asset:', err);
    return false;
  }
}

export default cloudinary;

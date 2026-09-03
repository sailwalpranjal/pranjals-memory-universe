import type { SupabaseClient } from '@supabase/supabase-js';

export const DEFAULT_STORAGE_BUCKET = 'memories';
export const DEFAULT_SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds
const MAX_BATCH_CHUNK_SIZE = 100; // Supabase recommended batch chunk limit

/**
 * Flexible input type supporting either raw storage path strings
 * or objects with a `storage_path` property.
 */
export type StoragePathLike = string | { storage_path?: string | null };

/**
 * Retrieves signed URLs in batch for an array of photo storage paths.
 *
 * Key Capabilities:
 * - Empty & Null Safety: Handles empty arrays, null/undefined items gracefully without network requests.
 * - Deduplication: Deduplicates identical paths prior to request to minimize payload size and API calls.
 * - Chunking: Chunks large requests into batches of 100 to avoid payload or URL length limits.
 * - Fast Lookup: Returns a `Map<string, string>` mapping original storage paths to their signed URLs.
 * - Fallback & Error Resilience: Returns valid URLs even if some individual paths fail or return errors.
 *
 * @param supabase - Authenticated SupabaseClient instance
 * @param pathsOrObjects - Array of storage path strings or objects containing `storage_path`
 * @param expiresIn - URL expiration time in seconds (default: 3600)
 * @param bucketName - Storage bucket name (default: 'memories')
 * @returns Map of storage_path to signed URL string
 */
export async function getSignedUrlsForPhotos(
  supabase: SupabaseClient,
  pathsOrObjects: StoragePathLike[],
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY,
  bucketName: string = DEFAULT_STORAGE_BUCKET
): Promise<Map<string, string>> {
  const urlMap = new Map<string, string>();

  if (!pathsOrObjects || !Array.isArray(pathsOrObjects) || pathsOrObjects.length === 0) {
    return urlMap;
  }

  // 1. Extract and sanitize raw path strings
  const rawPaths: string[] = [];
  for (const item of pathsOrObjects) {
    if (!item) continue;
    let path: string | null = null;
    if (typeof item === 'string') {
      path = item;
    } else if (typeof item === 'object' && item.storage_path) {
      path = item.storage_path;
    }

    if (path && typeof path === 'string') {
      const trimmed = path.trim().replace(/^\/+/, '');
      if (trimmed.length > 0) {
        rawPaths.push(trimmed);
      }
    }
  }

  if (rawPaths.length === 0) {
    return urlMap;
  }

  // 2. Deduplicate paths
  const uniquePaths = Array.from(new Set(rawPaths));

  // 3. Batch execute createSignedUrls in chunks
  const chunks: string[][] = [];
  for (let i = 0; i < uniquePaths.length; i += MAX_BATCH_CHUNK_SIZE) {
    chunks.push(uniquePaths.slice(i, i + MAX_BATCH_CHUNK_SIZE));
  }

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const { data, error } = await supabase.storage
          .from(bucketName)
          .createSignedUrls(chunk, expiresIn);

        if (error) {
          console.error(`[storage] createSignedUrls failed for bucket "${bucketName}":`, error.message);
          return;
        }

        if (data && Array.isArray(data)) {
          for (let idx = 0; idx < data.length; idx++) {
            const entry = data[idx];
            // Match path either from entry.path or original chunk index
            const pathKey = entry.path || chunk[idx];
            const signedUrl = entry.signedUrl || (entry as { signedURL?: string | null }).signedURL;

            if (pathKey && signedUrl) {
              urlMap.set(pathKey, signedUrl);
            }
          }
        }
      } catch (err) {
        console.error(`[storage] Unexpected error creating signed URLs:`, err);
      }
    })
  );

  return urlMap;
}

/**
 * Helper to fetch a single signed URL for a specific storage path.
 *
 * @param supabase - SupabaseClient instance
 * @param storagePath - Storage path of the file
 * @param expiresIn - Expiration in seconds (default: 3600)
 * @param bucketName - Storage bucket name (default: 'memories')
 * @returns Signed URL string or null if not found/error
 */
export async function getSignedUrlForPhoto(
  supabase: SupabaseClient,
  storagePath: string,
  expiresIn: number = DEFAULT_SIGNED_URL_EXPIRY,
  bucketName: string = DEFAULT_STORAGE_BUCKET
): Promise<string | null> {
  if (!storagePath || typeof storagePath !== 'string' || storagePath.trim() === '') {
    return null;
  }

  const cleanedPath = storagePath.trim().replace(/^\/+/, '');

  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(cleanedPath, expiresIn);

    if (error || !data?.signedUrl) {
      return null;
    }

    return data.signedUrl;
  } catch (err) {
    console.error(`[storage] Error generating signed URL for "${cleanedPath}":`, err);
    return null;
  }
}

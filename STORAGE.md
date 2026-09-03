# Pranjal's Universe — Storage Architecture

## Multi-Provider Storage Pipeline

Pranjal's Universe uses a dual-engine storage strategy combining high-performance global CDN delivery with private encrypted object storage.

```
[Uploaded Media]
       |
       +---> Cloudinary Online CDN
       |     - Folder: pranjal_universe
       |     - Public ID: pranjal_universe/pranjal_universe_{timestamp}_{cleanName}_{hash}
       |     - Tag: pranjal_universe
       |     - Strict Prefix Enforcement (foreign assets excluded)
       |
       +---> Supabase Private Object Storage
             - Bucket: memories
             - Path: users/00000000-0000-0000-0000-000000000000/photos/{YYYY}/{MM}/{UUID}/original.{ext}
             - Access: Time-limited signed URL generation (3600 seconds)
```

## Cloudinary Configuration
- **API Key**: `312437363419696`
- **Key Name**: `Images`
- **Cloud Name**: `Images`
- **Strict Naming Convention**: Only assets inside folder `pranjal_universe` and prefixed with `pranjal_universe_` are queryable or visible in the application. Any other assets uploaded to the Cloudinary account are strictly ignored.

## Supabase Storage Configuration
- **Bucket**: `memories` (private, encrypted)
- **Access Pattern**: All client requests receive authenticated signed URLs generated through `getSignedUrlForPhoto` or `getSignedUrlsForPhotos`.
- **MIME Support**: Direct byte streaming for `image/*`, `video/*` (MP4, WebM), and `audio/*` (WAV, MP3, M4A).

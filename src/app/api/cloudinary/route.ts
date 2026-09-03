import { NextResponse } from 'next/server';
import {
  testCloudinaryConnection,
  listPranjalUniverseAssets,
  CLOUDINARY_CONFIG,
  PRANJAL_FOLDER,
  PRANJAL_PREFIX,
  uploadToCloudinary,
} from '@/lib/cloudinary';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const connection = await testCloudinaryConnection();
  const assets = connection.success ? await listPranjalUniverseAssets(30) : [];

  return NextResponse.json({
    status: connection.success ? 'connected' : 'error',
    message: connection.message,
    cloudName: connection.cloudName,
    keyName: process.env.CLOUDINARY_KEY_NAME || 'Images',
    apiKeyMasked: CLOUDINARY_CONFIG.api_key ? 'Encrypted (Server-side)' : 'Not set',
    namingConvention: {
      folder: PRANJAL_FOLDER,
      prefix: PRANJAL_PREFIX,
      tag: 'pranjal_universe',
      description:
        'All images stored or queried strictly adhere to the pranjal_universe folder and pranjal_universe_* prefix. Foreign images in the bucket are automatically ignored.',
    },
    assetCount: assets.length,
    recentAssets: assets.map((a: { public_id: string; secure_url: string; bytes: number; created_at: string }) => ({
      publicId: a.public_id,
      url: a.secure_url,
      sizeBytes: a.bytes,
      createdAt: a.created_at,
    })),
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action || 'test';

    if (action === 'test') {
      const cloudNameOverride = body.cloudName;
      const testResult = await testCloudinaryConnection(cloudNameOverride);
      return NextResponse.json(testResult);
    }

    if (action === 'sync') {
      // Sync photos that don't have cloudinary_url yet
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { data: photos, error } = await supabase
        .from('photos')
        .select('id, storage_path, original_filename')
        .is('cloudinary_url', null)
        .limit(10);

      if (error) throw error;

      let syncedCount = 0;
      for (const p of photos || []) {
        try {
          const { data: fileData, error: downloadError } = await supabase.storage
            .from('memories')
            .download(p.storage_path);

          if (!downloadError && fileData) {
            const buf = Buffer.from(await fileData.arrayBuffer());
            const uploaded = await uploadToCloudinary(buf, p.original_filename || 'synced');
            if (uploaded?.url) {
              await supabase
                .from('photos')
                .update({
                  cloudinary_url: uploaded.url,
                  cloudinary_public_id: uploaded.publicId,
                  storage_provider: 'cloudinary',
                })
                .eq('id', p.id);
              syncedCount++;
            }
          }
        } catch (e) {
          console.warn('Sync photo failed:', p.id, e);
        }
      }

      return NextResponse.json({
        success: true,
        message: `Successfully synced ${syncedCount} photos to Cloudinary with strict naming convention.`,
        syncedCount,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

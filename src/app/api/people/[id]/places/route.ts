import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: personId } = await params;
  if (!personId) {
    return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch all faces of this person to get photo IDs
    const { data: faces, error: facesError } = await supabase
      .from('photo_faces')
      .select('photo_id')
      .eq('person_id', personId);

    if (facesError) throw facesError;

    const photoIds = Array.from(new Set((faces || []).map((f) => f.photo_id)));

    if (photoIds.length === 0) {
      return NextResponse.json({ places: [] });
    }

    // 2. Fetch photos with photo_metadata where coordinates exist
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('id, storage_path, original_filename, captured_at, photo_metadata(*)')
      .in('id', photoIds);

    if (photosError) throw photosError;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rawPlaces: any[] = [];
    const pathsToSign: string[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const photo of (photos as any[]) || []) {
      const meta = Array.isArray(photo.photo_metadata)
        ? photo.photo_metadata[0]
        : photo.photo_metadata;

      if (
        meta &&
        typeof meta.latitude === 'number' &&
        typeof meta.longitude === 'number' &&
        !isNaN(meta.latitude) &&
        !isNaN(meta.longitude)
      ) {
        rawPlaces.push({
          id: photo.id,
          photo_id: photo.id,
          lat: meta.latitude,
          lng: meta.longitude,
          city: meta.city || null,
          country: meta.country || null,
          storage_path: photo.storage_path,
          original_filename: photo.original_filename,
          captured_at: photo.captured_at,
        });

        if (photo.storage_path) {
          pathsToSign.push(photo.storage_path);
        }
      }
    }

    // 3. Batch generate signed URLs
    const urlMap = await getSignedUrlsForPhotos(supabase, pathsToSign, 3600);

    const places = rawPlaces.map((pl) => {
      const cleanPath = pl.storage_path ? pl.storage_path.trim().replace(/^\/+/, '') : '';
      const photoUrl = cleanPath
        ? urlMap.get(cleanPath) || urlMap.get(pl.storage_path) || null
        : null;

      return {
        id: pl.id,
        photo_id: pl.photo_id,
        lat: pl.lat,
        lng: pl.lng,
        city: pl.city,
        country: pl.country,
        photoUrl,
        captured_at: pl.captured_at,
        original_filename: pl.original_filename,
      };
    });

    return NextResponse.json({ places });
  } catch (error: unknown) {
    console.error(`[api/people/${personId}/places] GET error:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

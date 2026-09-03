import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface PhotoLocationJoin {
  id: string;
  storage_path: string;
  original_filename?: string;
  cloudinary_url?: string | null;
  captured_at?: string | null;
  mime_type?: string | null;
}

interface LocationRow {
  latitude: number;
  longitude: number;
  city?: string | null;
  country?: string | null;
  make?: string | null;
  model?: string | null;
  ai_title?: string | null;
  photos: PhotoLocationJoin | PhotoLocationJoin[] | null;
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: locations, error } = await supabase
      .from('photo_metadata')
      .select('latitude, longitude, city, country, make, model, ai_title, photos(id, storage_path, original_filename, cloudinary_url, captured_at, mime_type)')
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);

    if (error) throw error;

    const rawLocations: LocationRow[] = (locations as unknown as LocationRow[]) || [];

    // Filter and guard against null or missing photos relation
    const validLocations = rawLocations.filter((loc) => {
      const photo = Array.isArray(loc.photos) ? loc.photos[0] : loc.photos;
      return Boolean(photo && photo.id && (photo.storage_path || photo.cloudinary_url));
    });

    // Extract photo items that need Supabase signed URLs
    const photoList = validLocations
      .map((loc) => {
        const photo = Array.isArray(loc.photos) ? loc.photos[0] : loc.photos;
        return { storage_path: photo?.storage_path };
      })
      .filter((p) => Boolean(p.storage_path));

    const urlMap = await getSignedUrlsForPhotos(supabase, photoList, 3600);

    const places = validLocations.map((loc) => {
      const photo = Array.isArray(loc.photos) ? loc.photos[0] : loc.photos!;
      let url = photo.cloudinary_url || null;
      if (!url && photo.storage_path) {
        const cleanPath = photo.storage_path.trim().replace(/^\/+/, '');
        url = urlMap.get(cleanPath) || urlMap.get(photo.storage_path) || null;
      }

      return {
        id: photo.id,
        lat: loc.latitude,
        lng: loc.longitude,
        city: loc.city || 'Unknown City',
        country: loc.country || 'Unknown Country',
        make: loc.make || null,
        model: loc.model || null,
        aiTitle: loc.ai_title || photo.original_filename,
        url,
        capturedAt: photo.captured_at || null,
        mimeType: photo.mime_type || 'image/jpeg',
        filename: photo.original_filename || null,
      };
    });

    // Group into distinct destination clusters
    const cityMap = new Map<string, {
      city: string;
      country: string;
      lat: number;
      lng: number;
      photoCount: number;
      photos: typeof places;
      latestDate: string | null;
    }>();

    for (const p of places) {
      const key = `${p.city}, ${p.country}`;
      const existing = cityMap.get(key);
      if (existing) {
        existing.photoCount += 1;
        existing.photos.push(p);
        if (p.capturedAt && (!existing.latestDate || p.capturedAt > existing.latestDate)) {
          existing.latestDate = p.capturedAt;
        }
      } else {
        cityMap.set(key, {
          city: p.city,
          country: p.country,
          lat: p.lat,
          lng: p.lng,
          photoCount: 1,
          photos: [p],
          latestDate: p.capturedAt,
        });
      }
    }

    const cities = Array.from(cityMap.values()).sort((a, b) => b.photoCount - a.photoCount);

    return NextResponse.json({
      success: true,
      places,
      cities,
      totalGeotagged: places.length,
      totalDestinations: cities.length,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

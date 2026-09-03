import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') || 'json'; // 'json' | 'summary'

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Fetch all photos with metadata
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('*, photo_metadata(*)')
      .order('captured_at', { ascending: false, nullsFirst: false })
      .order('imported_at', { ascending: false });

    if (photosError) throw photosError;

    // Fetch all people
    const { data: people, error: peopleError } = await supabase
      .from('people')
      .select('*')
      .order('created_at', { ascending: false });

    if (peopleError && !peopleError.message.includes('does not exist')) throw peopleError;

    // Fetch all places
    const { data: places, error: placesError } = await supabase
      .from('photo_metadata')
      .select('city, country, latitude, longitude')
      .not('city', 'is', null);

    if (placesError) throw placesError;

    const uniquePlaces = places ? Array.from(
      new Map(places.map(p => [`${p.city},${p.country}`, p])).values()
    ) : [];

    if (format === 'summary') {
      return NextResponse.json({
        summary: {
          totalPhotos: photos?.length || 0,
          totalPeople: people?.length || 0,
          totalPlaces: uniquePlaces.length,
          exportFormats: ['json'],
        }
      });
    }

    // Build full JSON export
    const exportData = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      application: "Pranjal's Universe",
      photos: (photos || []).map(p => {
        const meta = Array.isArray(p.photo_metadata) ? p.photo_metadata[0] : p.photo_metadata;
        return {
          id: p.id,
          originalFilename: p.original_filename,
          capturedAt: p.captured_at,
          importedAt: p.imported_at,
          mimeType: p.mime_type,
          size: p.size_bytes,
          dimensions: p.width && p.height ? { width: p.width, height: p.height } : null,
          storagePath: p.storage_path,
          checksum: p.checksum,
          metadata: meta ? {
            camera: { make: meta.make, model: meta.model },
            location: meta.latitude ? { lat: meta.latitude, lng: meta.longitude, city: meta.city, country: meta.country } : null,
            ai: meta.ai_title ? { title: meta.ai_title, description: meta.ai_description, tags: meta.ai_tags } : null,
          } : null,
        };
      }),
      people: (people || []).map(p => ({
        id: p.id,
        name: p.name,
        createdAt: p.created_at,
      })),
      places: uniquePlaces.map(pl => ({
        city: pl.city,
        country: pl.country,
        coordinates: pl.latitude ? { lat: pl.latitude, lng: pl.longitude } : null,
      })),
    };

    return NextResponse.json(exportData, {
      headers: {
        'Content-Disposition': `attachment; filename="pranjal-universe-export-${Date.now()}.json"`,
        'Content-Type': 'application/json',
      }
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

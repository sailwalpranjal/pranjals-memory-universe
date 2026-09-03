import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface PhotoMetadataRow {
  photo_id?: string;
  make?: string | null;
  model?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  country?: string | null;
  ai_title?: string | null;
  ai_description?: string | null;
  ai_tags?: string[] | null;
  iso?: number | null;
}

interface PhotoRow {
  id: string;
  storage_path: string;
  original_filename?: string;
  captured_at?: string | null;
  imported_at?: string | null;
  is_favorite?: boolean | null;
  mime_type?: string | null;
  cloudinary_url?: string | null;
  photo_metadata?: PhotoMetadataRow | PhotoMetadataRow[] | null;
  url?: string | null;
  metadata?: PhotoMetadataRow | null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const limitParam = parseInt(searchParams.get('limit') || '50', 10);
  const limit = isNaN(limitParam) || limitParam <= 0 ? 50 : Math.min(limitParam, 200);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Query Photos with joined photo_metadata
    const { data: photos, error: photosError } = await supabase
      .from('photos')
      .select('*, photo_metadata(*)')
      .order('captured_at', { ascending: false, nullsFirst: false })
      .order('imported_at', { ascending: false });

    if (photosError) throw photosError;

    const rawPhotos: PhotoRow[] = (photos as PhotoRow[]) || [];

    // Filter photos based on search query matching across all metadata fields
    let filteredPhotos = rawPhotos;
    if (query) {
      const q = query.toLowerCase();
      filteredPhotos = rawPhotos.filter((p) => {
        const meta = Array.isArray(p.photo_metadata) ? p.photo_metadata[0] : p.photo_metadata;

        const matchName = typeof p.original_filename === 'string' && p.original_filename.toLowerCase().includes(q);
        const matchCity = typeof meta?.city === 'string' && meta.city.toLowerCase().includes(q);
        const matchCountry = typeof meta?.country === 'string' && meta.country.toLowerCase().includes(q);
        const matchAiTitle = typeof meta?.ai_title === 'string' && meta.ai_title.toLowerCase().includes(q);
        const matchAiDesc = typeof meta?.ai_description === 'string' && meta.ai_description.toLowerCase().includes(q);
        const matchAiTags = Array.isArray(meta?.ai_tags)
          ? meta.ai_tags.some((tag: unknown) => typeof tag === 'string' && tag.toLowerCase().includes(q))
          : typeof meta?.ai_tags === 'string' && (meta.ai_tags as string).toLowerCase().includes(q);
        const matchMake = typeof meta?.make === 'string' && meta.make.toLowerCase().includes(q);
        const matchModel = typeof meta?.model === 'string' && meta.model.toLowerCase().includes(q);

        // Naming convention matching
        const matchConvention = q.includes('pranjal') || (typeof p.original_filename === 'string' && p.original_filename.startsWith('pranjal_universe_'));

        // Semantic Intent: Favorites
        const matchFavorite = (q.includes('favorite') || q.includes('starred')) && p.is_favorite;

        // Semantic Intent: Media Type
        const matchVideo = (q.includes('video') || q.includes('clip')) && p.mime_type?.startsWith('video/');
        const matchAudio = (q.includes('audio') || q.includes('voice')) && p.mime_type?.startsWith('audio/');

        // Semantic Intent: Date / Year match
        const yearMatch = q.match(/\b(20\d{2})\b/);
        const matchYear = yearMatch && p.captured_at?.includes(yearMatch[1]);

        // Semantic Intent: Night / Twilight
        const matchNight = (q.includes('night') || q.includes('dark')) && (
          meta?.ai_tags?.some((t: string) => t.includes('night') || t.includes('dark')) ||
          (typeof meta?.iso === 'number' && meta.iso >= 800)
        );

        return (
          matchName ||
          matchCity ||
          matchCountry ||
          matchAiTitle ||
          matchAiDesc ||
          matchAiTags ||
          matchMake ||
          matchModel ||
          matchConvention ||
          matchFavorite ||
          matchVideo ||
          matchAudio ||
          matchYear ||
          matchNight
        );
      });
    }

    // Apply limit after filtering
    const limitedPhotos = filteredPhotos.slice(0, limit);

    // Batch generate signed URLs for photos
    const urlMap = await getSignedUrlsForPhotos(supabase, limitedPhotos, 3600);

    const results = limitedPhotos.map((photo: PhotoRow) => {
      let url = photo.cloudinary_url || null;
      if (!url && photo.storage_path) {
        const cleanPath = photo.storage_path.trim().replace(/^\/+/, '');
        url = urlMap.get(cleanPath) || urlMap.get(photo.storage_path) || null;
      }
      const meta = Array.isArray(photo.photo_metadata) ? photo.photo_metadata[0] || null : photo.photo_metadata || null;

      return {
        ...photo,
        url,
        metadata: meta,
      };
    });

    // 2. Query People matching query
    let matchedPeople: Array<{ id: string; name: string; created_at: string }> = [];
    if (query) {
      const { data: peopleData } = await supabase
        .from('people')
        .select('id, name, created_at')
        .ilike('name', `%${query}%`)
        .limit(10);
      if (peopleData) matchedPeople = peopleData;
    }

    // 3. Query Collections / Albums matching query
    let matchedCollections: Array<{ id: string; title: string; description: string | null }> = [];
    if (query) {
      const { data: colData } = await supabase
        .from('collections')
        .select('id, title, description')
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
        .limit(10);
      if (colData) matchedCollections = colData;
    }

    // 4. Query Meetings & Session Notes matching query
    let matchedMeetings: Array<{ id: string; title: string; notes: string | null; scheduled_at: string }> = [];
    if (query) {
      const { data: meetData } = await supabase
        .from('meetings')
        .select('id, title, notes, scheduled_at')
        .or(`title.ilike.%${query}%,notes.ilike.%${query}%`)
        .limit(10);
      if (meetData) matchedMeetings = meetData;
    }

    return NextResponse.json({
      results,
      people: matchedPeople,
      collections: matchedCollections,
      meetings: matchedMeetings,
      totalMatches: results.length + matchedPeople.length + matchedCollections.length + matchedMeetings.length,
    });
  } catch (error: unknown) {
    console.error('[api/search] GET error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
}

interface PhotoRow {
  id: string;
  storage_path: string;
  cloudinary_url?: string | null;
  cloudinary_public_id?: string | null;
  storage_provider?: string | null;
  is_favorite?: boolean | null;
  is_archived?: boolean | null;
  original_filename?: string;
  captured_at?: string | null;
  imported_at?: string | null;
  photo_metadata?: PhotoMetadataRow | PhotoMetadataRow[] | null;
  url?: string | null;
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('pranjal_admin_token');
  const guestToken = cookieStore.get('pranjal_guest_token');
  let isAdmin = false;
  if (adminToken && adminToken.value) {
    const { verifyToken } = require('@/lib/jwt');
    const p = await verifyToken(adminToken.value);
    if (p && p.role === 'admin') isAdmin = true;
  }
  const isGuest = guestToken && guestToken.value;
  
  if (!isAdmin && !isGuest) {
    return NextResponse.json({ error: 'Unauthorized. Biometric face authentication required.' }, { status: 401 });
  }

  const searchParams = request.url ? new URL(request.url).searchParams : new URLSearchParams();
  const onlyFavorites = searchParams.get('favorites') === 'true';
  const limitParam = parseInt(searchParams.get('limit') || '100', 10);
  const limit = isNaN(limitParam) || limitParam <= 0 ? 100 : Math.min(limitParam, 500);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const isTrash = searchParams.get('trash') === 'true' || searchParams.get('archived') === 'true';
  const mediaType = searchParams.get('type'); // 'photo' | 'video' | 'audio'

  try {
    let query = supabase
      .from('photos')
      .select('*, photo_metadata(*)');

    const personId = isGuest ? guestToken.value : searchParams.get('person_id');
    if (personId) {
      const { data: faces } = await supabase.from('photo_faces').select('photo_id').eq('person_id', personId);
      const photoIds = faces?.map(f => f.photo_id) || [];
      if (photoIds.length === 0) {
        return NextResponse.json({ photos: [], count: 0 });
      }
      query = query.in('id', photoIds);
    }

    if (isTrash) {
      query = query.eq('is_archived', true);
    } else {
      query = query.or('is_archived.is.null,is_archived.eq.false');
    }

    if (onlyFavorites) {
      query = query.eq('is_favorite', true);
    }

    if (mediaType === 'photo') {
      query = query.like('mime_type', 'image/%');
    } else if (mediaType === 'video') {
      query = query.like('mime_type', 'video/%');
    } else if (mediaType === 'audio') {
      query = query.like('mime_type', 'audio/%');
    }

    const { data: photos, error: dbError } = await query
      .order('captured_at', { ascending: false, nullsFirst: false })
      .order('imported_at', { ascending: false })
      .limit(limit);

    if (dbError) throw dbError;

    const rawPhotos: PhotoRow[] = (photos as PhotoRow[]) || [];

    // Filter which photos need Supabase signed URLs (photos that don't have direct cloudinary_url)
    const photosNeedingSignedUrls = rawPhotos.filter(
      (p) => !p.cloudinary_url && p.storage_path
    );

    // Batch generate signed URLs for those that need it
    const urlMap = await getSignedUrlsForPhotos(supabase, photosNeedingSignedUrls, 3600);

    const photosWithUrls = rawPhotos.map((photo) => {
      let finalUrl = photo.cloudinary_url || null;

      if (!finalUrl && photo.storage_path) {
        const cleanPath = photo.storage_path.trim().replace(/^\/+/, '');
        finalUrl = urlMap.get(cleanPath) || urlMap.get(photo.storage_path) || null;
      }

      const meta = Array.isArray(photo.photo_metadata)
        ? photo.photo_metadata[0] || null
        : photo.photo_metadata || null;

      return {
        ...photo,
        url: finalUrl,
        photo_metadata: meta,
      };
    });

    return NextResponse.json(
      { photos: photosWithUrls, count: photosWithUrls.length },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          Pragma: 'no-cache',
          Expires: '0',
        },
      }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}


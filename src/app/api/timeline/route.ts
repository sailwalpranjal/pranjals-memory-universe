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
}

interface PhotoRow {
  id: string;
  storage_path: string;
  original_filename?: string;
  captured_at?: string | null;
  imported_at?: string | null;
  photo_metadata?: PhotoMetadataRow | PhotoMetadataRow[] | null;
  url?: string | null;
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { data: photos, error: dbError } = await supabase
      .from('photos')
      .select('*, photo_metadata(*)')
      .or('is_archived.is.null,is_archived.eq.false')
      .order('captured_at', { ascending: false, nullsFirst: false })
      .order('imported_at', { ascending: false });
      
    if (dbError) throw dbError;

    const rawPhotos: PhotoRow[] = (photos as PhotoRow[]) || [];
    
    // Batch generate signed URLs for photos requiring Supabase storage
    const storagePhotos = rawPhotos.filter(
      (p) => !('cloudinary_url' in p && (p as { cloudinary_url?: string }).cloudinary_url) && p.storage_path
    );
    const urlMap = await getSignedUrlsForPhotos(supabase, storagePhotos, 3600);

    const photosWithUrls = rawPhotos.map((photo) => {
      const pAny = photo as unknown as { cloudinary_url?: string };
      let url = pAny.cloudinary_url || null;
      if (!url && photo.storage_path) {
        const cleanPath = photo.storage_path.trim().replace(/^\/+/, '');
        url = urlMap.get(cleanPath) || urlMap.get(photo.storage_path) || null;
      }
      const meta = Array.isArray(photo.photo_metadata) ? photo.photo_metadata[0] || null : photo.photo_metadata || null;

      return {
        ...photo,
        url,
        photo_metadata: meta
      };
    });
    
    // Group photos by date
    const grouped: Record<string, typeof photosWithUrls> = {};
    photosWithUrls.forEach((photo) => {
      const dateTarget = photo.captured_at || photo.imported_at;
      let dateStr = 'Undated';
      if (dateTarget) {
        try {
          const d = new Date(dateTarget);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString().split('T')[0];
          }
        } catch {
          dateStr = 'Undated';
        }
      }
      if (!grouped[dateStr]) grouped[dateStr] = [];
      grouped[dateStr].push(photo);
    });

    // Sort timeline grouped date keys descending (latest date first, 'Undated' at the end)
    const sortedDateKeys = Object.keys(grouped).sort((a, b) => {
      if (a === 'Undated') return 1;
      if (b === 'Undated') return -1;
      return b.localeCompare(a);
    });

    const timeline = sortedDateKeys.map(dateStr => {
      return {
        date: dateStr,
        photos: grouped[dateStr]
      };
    });
    
    return NextResponse.json({ timeline });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

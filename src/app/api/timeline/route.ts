import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cookieStore = cookies();
  const adminToken = cookieStore.get('pranjal_admin_token');
  const guestToken = cookieStore.get('pranjal_guest_token');
  const isAdmin = adminToken && adminToken.value === 'true';
  const isGuest = guestToken && guestToken.value;
  
  if (!isAdmin && !isGuest) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let query = supabase
      .from('photos')
      .select('*, photo_metadata(*)')
      .or('is_archived.is.null,is_archived.eq.false')
      .order('captured_at', { ascending: false, nullsFirst: false })
      .order('imported_at', { ascending: false });

    if (isGuest) {
      const { data: faces } = await supabase.from('photo_faces').select('photo_id').eq('person_id', guestToken.value);
      const photoIds = faces?.map(f => f.photo_id) || [];
      if (photoIds.length === 0) {
        return NextResponse.json({ photos: [] });
      }
      query = query.in('id', photoIds);
    }

    const { data: photos, error: dbError } = await query;
      
    if (dbError) throw dbError;

    const rawPhotos = photos || [];
    
    // Batch generate signed URLs
    const storagePhotos = rawPhotos.filter(
      (p) => !p.cloudinary_url && p.storage_path
    );
    const urlMap = await getSignedUrlsForPhotos(supabase, storagePhotos, 3600);

    const photosWithUrls = rawPhotos.map((photo) => {
      let url = photo.cloudinary_url || null;
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

    return NextResponse.json({ photos: photosWithUrls });
  } catch (err) {
    console.error('Timeline error:', err);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET() {
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

    if (isGuest && !isAdmin) {
      const { data: faces } = await supabase.from('photo_faces').select('photo_id').eq('person_id', guestToken.value);
      const photoIds = faces?.map(f => f.photo_id) || [];
      if (photoIds.length === 0) {
        return NextResponse.json({ timeline: [] });
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
  } catch (err) {
    console.error('Timeline error:', err);
    return NextResponse.json({ error: 'Failed to fetch timeline' }, { status: 500 });
  }
}

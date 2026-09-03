import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlForPhoto } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/collections
export async function GET() {
  const supabase = getSupabase();
  try {
    const { data: collections, error } = await supabase
      .from('collections')
      .select('*, photos:cover_photo_id(id, storage_path, cloudinary_url), collection_photos(photo_id)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const enriched = await Promise.all(
      (collections || []).map(async (col) => {
        let coverUrl: string | null = null;
        if (col.photos?.cloudinary_url) {
          coverUrl = col.photos.cloudinary_url;
        } else if (col.photos?.storage_path) {
          coverUrl = await getSignedUrlForPhoto(supabase, col.photos.storage_path, 3600);
        }

        return {
          id: col.id,
          title: col.title,
          description: col.description,
          category: col.category,
          cover_url: coverUrl,
          photo_count: col.collection_photos?.length || 0,
          created_at: col.created_at,
        };
      })
    );

    return NextResponse.json({ collections: enriched });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/collections
export async function POST(request: Request) {
  const supabase = getSupabase();
  try {
    const body = await request.json();
    const { title, description, category, cover_photo_id, photo_ids } = body;

    if (!title || typeof title !== 'string') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const { data: newCol, error } = await supabase
      .from('collections')
      .insert({
        title: title.trim(),
        description: description?.trim() || null,
        category: category || 'custom',
        cover_photo_id: cover_photo_id || (Array.isArray(photo_ids) && photo_ids.length > 0 ? photo_ids[0] : null),
      })
      .select()
      .single();

    if (error) throw error;

    // Attach photos if provided
    if (Array.isArray(photo_ids) && photo_ids.length > 0) {
      const inserts = photo_ids.map((pid: string) => ({
        collection_id: newCol.id,
        photo_id: pid,
      }));
      await supabase.from('collection_photos').insert(inserts);
    }

    return NextResponse.json({ success: true, collection: newCol });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

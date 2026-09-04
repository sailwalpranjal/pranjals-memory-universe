import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlForPhoto } from '@/lib/storage';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/collections/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });

  const supabase = getSupabase();
  try {
    const { data: col, error } = await supabase
      .from('collections')
      .select('*, photos:cover_photo_id(id, storage_path, cloudinary_url), collection_photos(photo:photo_id(*, photo_metadata(*)))')
      .eq('id', id)
      .single();

    if (error || !col) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    let coverUrl: string | null = null;
    if (col.photos?.cloudinary_url) {
      coverUrl = col.photos.cloudinary_url;
    } else if (col.photos?.storage_path) {
      coverUrl = await getSignedUrlForPhoto(supabase, col.photos.storage_path, 3600);
    }

    // Resolve URLs for attached photos
    const attachedPhotos = await Promise.all(
      (col.collection_photos || []).map(async (cp: { photo?: Record<string, unknown> }) => {
        if (!cp.photo) return null;
        const photo = cp.photo as Record<string, unknown>;
        let url = (photo.cloudinary_url as string) || null;
        if (!url && photo.storage_path) {
          url = await getSignedUrlForPhoto(supabase, photo.storage_path as string, 3600);
        }
        return {
          ...photo,
          url,
          photo_metadata: Array.isArray(photo.photo_metadata)
            ? photo.photo_metadata[0] || null
            : photo.photo_metadata || null,
        };
      })
    );

    return NextResponse.json({
      collection: {
        id: col.id,
        title: col.title,
        description: col.description,
        category: col.category,
        cover_url: coverUrl,
        created_at: col.created_at,
        photos: attachedPhotos.filter(Boolean),
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/collections/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });

  const supabase = getSupabase();
  try {
    const body = await request.json();
    const { title, description, category, cover_photo_id, add_photo_ids, remove_photo_ids } = body;

    const updates: Record<string, unknown> = {};
    if (typeof title === 'string') updates.title = title.trim();
    if (typeof description === 'string') updates.description = description.trim();
    if (typeof category === 'string') updates.category = category;
    if (cover_photo_id !== undefined) updates.cover_photo_id = cover_photo_id;

    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from('collections')
        .update(updates)
        .eq('id', id);
      if (updateErr) throw updateErr;
    }

    if (Array.isArray(add_photo_ids) && add_photo_ids.length > 0) {
      const inserts = add_photo_ids.map((pid: string) => ({
        collection_id: id,
        photo_id: pid,
      }));
      await supabase.from('collection_photos').upsert(inserts, { onConflict: 'collection_id,photo_id' });
    }

    if (Array.isArray(remove_photo_ids) && remove_photo_ids.length > 0) {
      await supabase
        .from('collection_photos')
        .delete()
        .eq('collection_id', id)
        .in('photo_id', remove_photo_ids);
    }

    return NextResponse.json({ success: true, message: 'Collection updated' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/collections/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });

  const supabase = getSupabase();
  try {
    // Delete collection entries (collection_photos cascades or deleted explicitly)
    await supabase.from('collection_photos').delete().eq('collection_id', id);
    const { error } = await supabase.from('collections').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Collection deleted successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

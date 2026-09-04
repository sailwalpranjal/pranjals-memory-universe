import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlForPhoto } from '@/lib/storage';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// GET /api/photos/[id]
export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const supabase = getSupabase();
  try {
    const { data: photo, error } = await supabase
      .from('photos')
      .select('*, photo_metadata(*), photo_faces(*, people(*))')
      .eq('id', id)
      .single();

    if (error || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    let url = photo.cloudinary_url;
    if (!url && photo.storage_path) {
      url = await getSignedUrlForPhoto(supabase, photo.storage_path, 3600);
    }

    const meta = Array.isArray(photo.photo_metadata)
      ? photo.photo_metadata[0] || null
      : photo.photo_metadata || null;

    return NextResponse.json({
      photo: {
        ...photo,
        url,
        photo_metadata: meta,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/photos/[id]
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const supabase = getSupabase();
  try {
    const body = await request.json();
    const {
      is_favorite,
      is_archived,
      ai_title,
      ai_description,
      ai_tags,
      city,
      country,
    } = body;

    // Update photo level flags
    const photoUpdates: Record<string, unknown> = {};
    if (typeof is_favorite === 'boolean') photoUpdates.is_favorite = is_favorite;
    if (typeof is_archived === 'boolean') photoUpdates.is_archived = is_archived;

    if (Object.keys(photoUpdates).length > 0) {
      const { error: photoErr } = await supabase
        .from('photos')
        .update(photoUpdates)
        .eq('id', id);

      if (photoErr) throw photoErr;
    }

    // Update metadata
    const metaUpdates: Record<string, unknown> = {};
    if (typeof ai_title === 'string') metaUpdates.ai_title = ai_title;
    if (typeof ai_description === 'string') metaUpdates.ai_description = ai_description;
    if (Array.isArray(ai_tags)) metaUpdates.ai_tags = ai_tags;
    if (typeof city === 'string') metaUpdates.city = city;
    if (typeof country === 'string') metaUpdates.country = country;

    if (Object.keys(metaUpdates).length > 0) {
      const { error: metaErr } = await supabase
        .from('photo_metadata')
        .upsert(
          {
            photo_id: id,
            ...metaUpdates,
          },
          { onConflict: 'photo_id' }
        );

      if (metaErr) throw metaErr;
    }

    return NextResponse.json({ success: true, message: 'Photo updated successfully' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/photos/[id]
export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

  const supabase = getSupabase();
  try {
    // 1. Fetch photo to get storage path and cloudinary ID
    const { data: photo, error: fetchErr } = await supabase
      .from('photos')
      .select('id, storage_path, cloudinary_public_id')
      .eq('id', id)
      .single();

    if (fetchErr || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    // 2. Delete from Cloudinary if stored there
    if (photo.cloudinary_public_id) {
      try {
        await deleteFromCloudinary(photo.cloudinary_public_id);
      } catch (cErr) {
        console.warn('Failed to delete from Cloudinary:', cErr);
      }
    }

    // 3. Delete from Supabase Storage
    if (photo.storage_path) {
      try {
        await supabase.storage.from('memories').remove([photo.storage_path]);
      } catch (sErr) {
        console.warn('Failed to delete from Supabase storage:', sErr);
      }
    }

    // 4. Delete from Database (cascades to photo_metadata and photo_faces)
    const { error: dbErr } = await supabase
      .from('photos')
      .delete()
      .eq('id', id);

    if (dbErr) throw dbErr;

    return NextResponse.json({ success: true, message: 'Photo deleted permanently' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

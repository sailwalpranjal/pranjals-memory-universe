import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { deleteFromCloudinary } from '@/lib/cloudinary';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getSupabase() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

// POST /api/photos/bulk
export async function POST(request: Request) {
  const supabase = getSupabase();
  try {
    const body = await request.json();
    const { action, ids, tag } = body;

    if (!action || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'action and non-empty ids array are required' },
        { status: 400 }
      );
    }

    if (action === 'favorite') {
      const { error } = await supabase
        .from('photos')
        .update({ is_favorite: true })
        .in('id', ids);
      if (error) throw error;
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === 'unfavorite') {
      const { error } = await supabase
        .from('photos')
        .update({ is_favorite: false })
        .in('id', ids);
      if (error) throw error;
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === 'archive' || action === 'recycle') {
      const { error } = await supabase
        .from('photos')
        .update({ is_archived: true })
        .in('id', ids);
      if (error) throw error;
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === 'restore') {
      const { error } = await supabase
        .from('photos')
        .update({ is_archived: false })
        .in('id', ids);
      if (error) throw error;
      return NextResponse.json({ success: true, count: ids.length });
    }

    if (action === 'delete') {
      // 1. Fetch storage paths and Cloudinary IDs
      const { data: photos, error: fetchErr } = await supabase
        .from('photos')
        .select('id, storage_path, cloudinary_public_id')
        .in('id', ids);

      if (fetchErr) throw fetchErr;

      const storagePathsToDelete: string[] = [];
      for (const p of photos || []) {
        if (p.cloudinary_public_id) {
          try {
            await deleteFromCloudinary(p.cloudinary_public_id);
          } catch (cErr) {
            console.warn('Failed Cloudinary removal for:', p.id, cErr);
          }
        }
        if (p.storage_path) {
          storagePathsToDelete.push(p.storage_path);
        }
      }

      if (storagePathsToDelete.length > 0) {
        try {
          await supabase.storage.from('memories').remove(storagePathsToDelete);
        } catch (sErr) {
          console.warn('Failed Supabase storage removal:', sErr);
        }
      }

      // Delete from DB (cascades to metadata and faces)
      const { error: deleteErr } = await supabase
        .from('photos')
        .delete()
        .in('id', ids);

      if (deleteErr) throw deleteErr;

      return NextResponse.json({ success: true, deleted_count: ids.length });
    }

    if (action === 'add_tag' && typeof tag === 'string' && tag.trim()) {
      const cleanTag = tag.trim().toLowerCase();
      // Fetch current metadata for these photos
      const { data: metas } = await supabase
        .from('photo_metadata')
        .select('photo_id, ai_tags')
        .in('photo_id', ids);

      for (const m of metas || []) {
        const existingTags = Array.isArray(m.ai_tags) ? m.ai_tags : [];
        if (!existingTags.includes(cleanTag)) {
          await supabase
            .from('photo_metadata')
            .update({ ai_tags: [...existingTags, cleanTag] })
            .eq('photo_id', m.photo_id);
        }
      }

      return NextResponse.json({ success: true, tagged_count: ids.length });
    }

    return NextResponse.json({ error: `Unsupported bulk action: ${action}` }, { status: 400 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

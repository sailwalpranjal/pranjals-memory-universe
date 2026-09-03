import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { targetPersonId, sourcePersonIds } = body;

    if (!targetPersonId || typeof targetPersonId !== 'string') {
      return NextResponse.json({ error: 'targetPersonId is required' }, { status: 400 });
    }

    if (!Array.isArray(sourcePersonIds) || sourcePersonIds.length === 0) {
      return NextResponse.json({ error: 'sourcePersonIds must be a non-empty array' }, { status: 400 });
    }

    // Filter out targetPersonId if present in sourcePersonIds
    const sources = sourcePersonIds.filter(
      (id: unknown) => typeof id === 'string' && id.trim() !== '' && id !== targetPersonId
    );

    if (sources.length === 0) {
      return NextResponse.json({
        success: true,
        targetPersonId,
        message: 'No distinct source persons to merge',
      });
    }

    // Try PostgreSQL RPC function merge_people
    let rpcSuccess = false;
    try {
      const { error: rpcError } = await supabase.rpc('merge_people', {
        target_person_id: targetPersonId,
        source_person_ids: sources,
      });

      if (!rpcError) {
        rpcSuccess = true;
      } else {
        console.warn('[api/people/merge] RPC error, falling back to direct query:', rpcError.message);
      }
    } catch (rpcErr) {
      console.warn('[api/people/merge] RPC call exception, falling back:', rpcErr);
    }

    // Fallback: direct updates if RPC is not available
    if (!rpcSuccess) {
      // 1. Reassign all photo_faces to targetPersonId
      const { error: facesUpdateError } = await supabase
        .from('photo_faces')
        .update({ person_id: targetPersonId })
        .in('person_id', sources);

      if (facesUpdateError) throw facesUpdateError;

      // 2. Delete source people records
      const { error: peopleDeleteError } = await supabase
        .from('people')
        .delete()
        .in('id', sources);

      if (peopleDeleteError) throw peopleDeleteError;
    }

    return NextResponse.json({
      success: true,
      targetPersonId,
      mergedCount: sources.length,
    });
  } catch (error: unknown) {
    console.error('[api/people/merge] POST error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

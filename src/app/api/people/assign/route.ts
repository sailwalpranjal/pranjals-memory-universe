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
    const { faceId, photoId, personId, newPersonName } = body;

    if (!faceId && !photoId) {
      return NextResponse.json({ error: 'Either faceId or photoId is required' }, { status: 400 });
    }

    if (!personId && !newPersonName) {
      return NextResponse.json(
        { error: 'Either personId or newPersonName must be provided' },
        { status: 400 }
      );
    }

    let finalPersonId = personId;
    let finalPersonName: string | null = null;
    let targetPhotoId = photoId;

    // 1. If faceId is provided, get the photo_id from photo_faces
    if (faceId) {
      const { data: face, error: faceError } = await supabase
        .from('photo_faces')
        .select('id, photo_id, person_id')
        .eq('id', faceId)
        .single();

      if (faceError || !face) {
        return NextResponse.json({ error: 'Face record not found' }, { status: 404 });
      }
      targetPhotoId = face.photo_id;
    }

    // 2. If creating a new person
    if (!finalPersonId && newPersonName) {
      const trimmedName = String(newPersonName).trim();
      if (!trimmedName) {
        return NextResponse.json({ error: 'Person name cannot be empty' }, { status: 400 });
      }

      // Check if person already exists by name (case-insensitive)
      const { data: existingByName } = await supabase
        .from('people')
        .select('id, name')
        .ilike('name', trimmedName)
        .order('created_at', { ascending: true })
        .limit(1);

      if (existingByName && existingByName.length > 0) {
        finalPersonId = existingByName[0].id;
        finalPersonName = existingByName[0].name;
      } else {

      const dummyUserId = '00000000-0000-0000-0000-000000000000';
      const { data: newPerson, error: createError } = await supabase
        .from('people')
        .insert({
          user_id: dummyUserId,
          name: trimmedName,
          cover_photo_id: targetPhotoId || null,
        })
        .select('id, name')
        .single();

      if (createError || !newPerson) {
        throw createError || new Error('Failed to create person');
      }

      finalPersonId = newPerson.id;
      finalPersonName = newPerson.name;
      }
    } else if (finalPersonId) {
      // Verify existing person
      const { data: existingPerson, error: personError } = await supabase
        .from('people')
        .select('id, name, cover_photo_id')
        .eq('id', finalPersonId)
        .single();

      if (personError || !existingPerson) {
        return NextResponse.json({ error: 'Target person not found' }, { status: 404 });
      }

      finalPersonName = existingPerson.name;

      // If existing person lacks a cover photo, update it with this photo
      if (!existingPerson.cover_photo_id && targetPhotoId) {
        await supabase
          .from('people')
          .update({ cover_photo_id: targetPhotoId })
          .eq('id', finalPersonId);
      }
    }

    // 3. Assign face or associate photo
    if (faceId) {
      const { error: assignError } = await supabase
        .from('photo_faces')
        .update({ person_id: finalPersonId })
        .eq('id', faceId);

      if (assignError) throw assignError;
    } else if (targetPhotoId) {
      // Check if this photo is already linked to this person
      const { data: existingLink } = await supabase
        .from('photo_faces')
        .select('id')
        .eq('photo_id', targetPhotoId)
        .eq('person_id', finalPersonId)
        .maybeSingle();

      if (!existingLink) {
        await supabase.from('photo_faces').insert({
          photo_id: targetPhotoId,
          person_id: finalPersonId,
          confidence: 1.0,
          bounding_box: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        });
      }
    }

    return NextResponse.json({
      success: true,
      personId: finalPersonId,
      personName: finalPersonName,
      faceId: faceId || null,
      photoId: targetPhotoId || null,
    });
  } catch (error: unknown) {
    console.error('[api/people/assign] POST error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

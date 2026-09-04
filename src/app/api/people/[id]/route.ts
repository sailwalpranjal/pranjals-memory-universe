import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: {
    id: string;
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const personId = params.id;
  if (!personId) {
    return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch person details
    const { data: person, error: personError } = await supabase
      .from('people')
      .select('id, name, cover_photo_id, created_at, photos:cover_photo_id(id, storage_path)')
      .eq('id', personId)
      .single();

    if (personError || !person) {
      return NextResponse.json({ error: 'Person not found' }, { status: 404 });
    }

    // 2. Fetch all face records for this person with photo and metadata relations
    const { data: personFaces, error: facesError } = await supabase
      .from('photo_faces')
      .select(
        'id, photo_id, person_id, bounding_box, confidence, created_at, photos(id, storage_path, original_filename, captured_at, imported_at, width, height, photo_metadata(*))'
      )
      .eq('person_id', personId)
      .order('created_at', { ascending: false });

    if (facesError) throw facesError;

    // Collect distinct photo records
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const photoMap = new Map<string, any>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const facesList = (personFaces as any[]) || [];

    for (const f of facesList) {
      if (f.photos && !photoMap.has(f.photo_id)) {
        photoMap.set(f.photo_id, {
          ...f.photos,
          faceBox: f.bounding_box,
        });
      }
    }

    const personPhotoIds = Array.from(photoMap.keys());

    // 3. Find companions (co-appearing people in the same photos)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companionMap = new Map<string, { id: string; name: string; sharedPhotos: Set<string>; coverPhotoId: string | null; sampleBox: any; storagePath?: string | null }>();

    if (personPhotoIds.length > 0) {
      const { data: coFaces, error: coError } = await supabase
        .from('photo_faces')
        .select('id, photo_id, person_id, bounding_box, people(id, name, cover_photo_id), photos(id, storage_path)')
        .in('photo_id', personPhotoIds)
        .neq('person_id', personId)
        .not('person_id', 'is', null);

      if (!coError && coFaces) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const cf of coFaces as any[]) {
          if (!cf.person_id || !cf.people) continue;
          const cId = cf.person_id;
          const existing = companionMap.get(cId) || {
            id: cId,
            name: cf.people.name || 'Unnamed Person',
            sharedPhotos: new Set<string>(),
            coverPhotoId: cf.people.cover_photo_id,
            sampleBox: cf.bounding_box,
            storagePath: cf.photos?.storage_path || null,
          };
          existing.sharedPhotos.add(cf.photo_id);
          companionMap.set(cId, existing);
        }
      }
    }

    // 4. Collect visited places from geotagged photos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const placesRaw: any[] = [];
    for (const photo of photoMap.values()) {
      const meta = Array.isArray(photo.photo_metadata) ? photo.photo_metadata[0] : photo.photo_metadata;
      if (meta && typeof meta.latitude === 'number' && typeof meta.longitude === 'number') {
        placesRaw.push({
          id: photo.id,
          photo_id: photo.id,
          lat: meta.latitude,
          lng: meta.longitude,
          city: meta.city || null,
          country: meta.country || null,
          captured_at: photo.captured_at,
          storage_path: photo.storage_path,
          original_filename: photo.original_filename,
        });
      }
    }

    // 5. Gather all paths to sign
    const pathsToSign: string[] = [];

    // Person cover photo
    const personCoverFace = facesList.find((f) => f.photo_id === person.cover_photo_id) || facesList[0] || null;
    const personCoverPath = personCoverFace?.photos?.storage_path || (person.photos as { storage_path?: string } | null)?.storage_path || null;
    if (personCoverPath) pathsToSign.push(personCoverPath);

    // All photos
    for (const photo of photoMap.values()) {
      if (photo.storage_path) pathsToSign.push(photo.storage_path);
    }

    // Companion cover paths
    for (const comp of companionMap.values()) {
      if (comp.storagePath) pathsToSign.push(comp.storagePath);
    }

    // 6. Batch get signed URLs
    const urlMap = await getSignedUrlsForPhotos(supabase, pathsToSign, 3600);

    const personCoverClean = personCoverPath ? personCoverPath.trim().replace(/^\/+/, '') : '';
    const coverPhotoUrl = personCoverClean ? urlMap.get(personCoverClean) || urlMap.get(personCoverPath!) || null : null;

    // Build Photos array
    const photos = Array.from(photoMap.values()).map((p) => {
      const cleanPath = p.storage_path ? p.storage_path.trim().replace(/^\/+/, '') : '';
      const url = cleanPath ? urlMap.get(cleanPath) || urlMap.get(p.storage_path) || null : null;
      const meta = Array.isArray(p.photo_metadata) ? p.photo_metadata[0] || null : p.photo_metadata || null;

      return {
        id: p.id,
        storage_path: p.storage_path,
        url,
        original_filename: p.original_filename,
        captured_at: p.captured_at,
        imported_at: p.imported_at,
        width: p.width,
        height: p.height,
        photo_metadata: meta,
        faceBox: p.faceBox,
      };
    });

    // Sort photos chronologically (newest to oldest)
    photos.sort((a, b) => {
      const dateA = a.captured_at || a.imported_at || '';
      const dateB = b.captured_at || b.imported_at || '';
      return dateB.localeCompare(dateA);
    });

    // Build Companions array
    const companions = Array.from(companionMap.values()).map((c) => {
      const cleanPath = c.storagePath ? c.storagePath.trim().replace(/^\/+/, '') : '';
      const cUrl = cleanPath ? urlMap.get(cleanPath) || urlMap.get(c.storagePath!) || null : null;

      return {
        id: c.id,
        name: c.name,
        sharedPhotoCount: c.sharedPhotos.size,
        coverPhotoUrl: cUrl,
        boundingBox: c.sampleBox,
      };
    });

    // Sort companions by shared photo count descending
    companions.sort((a, b) => b.sharedPhotoCount - a.sharedPhotoCount);

    // Build Places array
    const places = placesRaw.map((pl) => {
      const cleanPath = pl.storage_path ? pl.storage_path.trim().replace(/^\/+/, '') : '';
      const pUrl = cleanPath ? urlMap.get(cleanPath) || urlMap.get(pl.storage_path) || null : null;

      return {
        id: pl.id,
        photo_id: pl.photo_id,
        lat: pl.lat,
        lng: pl.lng,
        city: pl.city,
        country: pl.country,
        photoUrl: pUrl,
        captured_at: pl.captured_at,
        original_filename: pl.original_filename,
      };
    });

    // Determine firstSeen and lastSeen
    const firstSeen = photos.length > 0 ? (photos[photos.length - 1].captured_at || photos[photos.length - 1].imported_at) : person.created_at;
    const lastSeen = photos.length > 0 ? (photos[0].captured_at || photos[0].imported_at) : person.created_at;

    return NextResponse.json({
      person: {
        id: person.id,
        name: person.name || 'Unnamed Person',
        cover_photo_id: person.cover_photo_id,
        coverPhotoUrl,
        boundingBox: personCoverFace?.bounding_box || null,
        created_at: person.created_at,
        photoCount: photos.length,
        faceCount: facesList.length,
        firstSeen,
        lastSeen,
      },
      photos,
      companions,
      places,
    });
  } catch (error: unknown) {
    console.error(`[api/people/${personId}] GET error:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const personId = params.id;
  if (!personId) {
    return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { name, cover_photo_id } = body;

    if (name === undefined && cover_photo_id === undefined) {
      return NextResponse.json({ error: 'At least one field (name or cover_photo_id) must be provided' }, { status: 400 });
    }

    const updates: { name?: string; cover_photo_id?: string } = {};
    if (typeof name === 'string') {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }
      updates.name = trimmed;
    }

    if (cover_photo_id !== undefined) {
      updates.cover_photo_id = cover_photo_id;
    }

    const { data: updatedPerson, error } = await supabase
      .from('people')
      .update(updates)
      .eq('id', personId)
      .select('id, name, cover_photo_id, created_at')
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      person: updatedPerson,
    });
  } catch (error: unknown) {
    console.error(`[api/people/${personId}] PATCH error:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const personId = params.id;
  if (!personId) {
    return NextResponse.json({ error: 'Person ID is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Unlink any faces assigned to this person (sets person_id = null)
    await supabase
      .from('photo_faces')
      .update({ person_id: null })
      .eq('person_id', personId);

    // 2. Delete person record from people table
    const { error: deleteError } = await supabase
      .from('people')
      .delete()
      .eq('id', personId);

    if (deleteError) throw deleteError;

    return NextResponse.json({
      success: true,
      message: 'Person deleted and faces unassigned successfully',
    });
  } catch (error: unknown) {
    console.error(`[api/people/${personId}] DELETE error:`, error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

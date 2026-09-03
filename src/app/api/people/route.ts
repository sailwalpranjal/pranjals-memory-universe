import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface PhotoRel {
  id?: string;
  storage_path?: string | null;
  original_filename?: string | null;
  cloudinary_url?: string | null;
  captured_at?: string | null;
  imported_at?: string | null;
  mime_type?: string | null;
}

interface PersonRow {
  id: string;
  name: string | null;
  cover_photo_id: string | null;
  created_at: string;
  photos?: PhotoRel | PhotoRel[] | null;
}

interface FaceRow {
  id: string;
  photo_id: string;
  person_id: string | null;
  bounding_box: unknown;
  confidence?: number | null;
  created_at: string;
  photos?: PhotoRel | PhotoRel[] | null;
}

function getPhotoRel(p?: PhotoRel | PhotoRel[] | null): PhotoRel | null {
  if (!p) return null;
  if (Array.isArray(p)) return p[0] || null;
  return p;
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Fetch all people profiles
    const { data: peopleData, error: peopleError } = await supabase
      .from('people')
      .select('id, name, cover_photo_id, created_at, photos:cover_photo_id(id, storage_path, original_filename, cloudinary_url, captured_at, mime_type)')
      .order('created_at', { ascending: false });

    if (peopleError) throw peopleError;

    // 2. Fetch all face detections with photo relations
    const { data: facesData, error: facesError } = await supabase
      .from('photo_faces')
      .select('id, photo_id, person_id, bounding_box, confidence, created_at, photos(id, storage_path, original_filename, cloudinary_url, captured_at, imported_at, mime_type)')
      .order('created_at', { ascending: false });

    if (facesError) throw facesError;

    const allPeople = (peopleData as unknown as PersonRow[]) || [];
    const allFaces = (facesData as unknown as FaceRow[]) || [];

    // 3. Map faces by person_id and identify unassigned faces
    const facesByPerson = new Map<string, FaceRow[]>();
    const unassignedFacesRaw: FaceRow[] = [];

    for (const face of allFaces) {
      if (face.person_id) {
        const list = facesByPerson.get(face.person_id) || [];
        list.push(face);
        facesByPerson.set(face.person_id, list);
      } else {
        unassignedFacesRaw.push(face);
      }
    }

    // 4. Collect all storage paths for batch signed URL generation
    const pathsToSign: string[] = [];

    // From people cover photos / faces
    for (const person of allPeople) {
      const personFaces = facesByPerson.get(person.id) || [];
      const personPhoto = getPhotoRel(person.photos);
      let selectedPath: string | null = null;

      if (person.cover_photo_id) {
        const coverFace = personFaces.find((f) => f.photo_id === person.cover_photo_id);
        const coverFacePhoto = getPhotoRel(coverFace?.photos);
        if (coverFacePhoto?.storage_path && !coverFacePhoto.cloudinary_url) {
          selectedPath = coverFacePhoto.storage_path;
        } else if (personPhoto?.storage_path && !personPhoto.cloudinary_url) {
          selectedPath = personPhoto.storage_path;
        }
      }
      if (!selectedPath && personFaces.length > 0) {
        const firstFacePhoto = getPhotoRel(personFaces[0].photos);
        if (firstFacePhoto?.storage_path && !firstFacePhoto.cloudinary_url) {
          selectedPath = firstFacePhoto.storage_path;
        }
      }

      if (selectedPath) {
        pathsToSign.push(selectedPath);
      }
    }

    // From unassigned faces
    for (const uFace of unassignedFacesRaw) {
      const uFacePhoto = getPhotoRel(uFace.photos);
      if (uFacePhoto?.storage_path && !uFacePhoto.cloudinary_url) {
        pathsToSign.push(uFacePhoto.storage_path);
      }
    }

    // 5. Batch generate signed URLs
    const uniquePaths = Array.from(new Set(pathsToSign));
    const urlMap = await getSignedUrlsForPhotos(
      supabase,
      uniquePaths.map((p) => ({ storage_path: p })),
      3600
    );

    // 6. Build enriched People array
    const people = allPeople.map((person) => {
      const personFaces = facesByPerson.get(person.id) || [];
      const uniquePhotoIds = new Set(personFaces.map((f) => f.photo_id));
      if (person.cover_photo_id) uniquePhotoIds.add(person.cover_photo_id);

      // Resolve cover photo URL
      let coverPhotoUrl: string | null = null;
      let coverFace: FaceRow | null = null;
      const personPhoto = getPhotoRel(person.photos);

      if (person.cover_photo_id) {
        coverFace = personFaces.find((f) => f.photo_id === person.cover_photo_id) || null;
        const coverFacePhoto = getPhotoRel(coverFace?.photos);
        coverPhotoUrl = coverFacePhoto?.cloudinary_url || personPhoto?.cloudinary_url || null;

        if (!coverPhotoUrl) {
          const path = coverFacePhoto?.storage_path || personPhoto?.storage_path || null;
          if (path) {
            const cleanPath = path.trim().replace(/^\/+/, '');
            coverPhotoUrl = urlMap.get(cleanPath) || urlMap.get(path) || null;
          }
        }
      }

      if (!coverPhotoUrl && personFaces.length > 0) {
        coverFace = personFaces[0];
        const firstFacePhoto = getPhotoRel(coverFace.photos);
        coverPhotoUrl = firstFacePhoto?.cloudinary_url || null;
        if (!coverPhotoUrl) {
          const path = firstFacePhoto?.storage_path || null;
          if (path) {
            const cleanPath = path.trim().replace(/^\/+/, '');
            coverPhotoUrl = urlMap.get(cleanPath) || urlMap.get(path) || null;
          }
        }
      }

      // Compute last seen date
      let lastSeen: string | null = null;
      for (const f of personFaces) {
        const fPhoto = getPhotoRel(f.photos);
        const faceDate = fPhoto?.captured_at || fPhoto?.imported_at || f.created_at;
        if (faceDate) {
          if (!lastSeen || new Date(faceDate).getTime() > new Date(lastSeen).getTime()) {
            lastSeen = faceDate;
          }
        }
      }
      if (!lastSeen) {
        lastSeen = personPhoto?.captured_at || person.created_at;
      }

      return {
        id: person.id,
        name: person.name || 'Unnamed Person',
        photoCount: uniquePhotoIds.size,
        faceCount: personFaces.length,
        coverPhotoUrl,
        boundingBox: coverFace?.bounding_box || null,
        lastSeen,
        createdAt: person.created_at,
      };
    });

    // 7. Build enriched Unassigned Faces array
    const unassignedFaces = unassignedFacesRaw.map((uFace) => {
      const uFacePhoto = getPhotoRel(uFace.photos);
      let photoUrl = uFacePhoto?.cloudinary_url || null;
      if (!photoUrl && uFacePhoto?.storage_path) {
        const cleanPath = uFacePhoto.storage_path.trim().replace(/^\/+/, '');
        photoUrl = urlMap.get(cleanPath) || urlMap.get(uFacePhoto.storage_path) || null;
      }

      return {
        id: uFace.id,
        photo_id: uFace.photo_id,
        photoUrl,
        boundingBox: uFace.bounding_box || null,
        filename: uFacePhoto?.original_filename || null,
        capturedAt: uFacePhoto?.captured_at || uFace.created_at,
      };
    });

    return NextResponse.json({
      people,
      unassignedFaces,
      totalPeople: people.length,
      totalUnassigned: unassignedFaces.length,
    });
  } catch (error: unknown) {
    console.error('[api/people] GET error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await request.json();
    const { name, coverPhotoId, photoIds } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Person name is required' }, { status: 400 });
    }

    const dummyUserId = '00000000-0000-0000-0000-000000000000';
    const { data: newPerson, error: insertError } = await supabase
      .from('people')
      .insert({
        name: name.trim(),
        user_id: dummyUserId,
        cover_photo_id: coverPhotoId || (photoIds && photoIds[0]) || null,
      })
      .select('*')
      .single();

    if (insertError) throw insertError;

    // Link initial photos if provided
    if (Array.isArray(photoIds) && photoIds.length > 0) {
      for (const pId of photoIds) {
        await supabase.from('photo_faces').insert({
          photo_id: pId,
          person_id: newPerson.id,
          confidence: 1.0,
          bounding_box: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
        });
      }
    }

    return NextResponse.json({ success: true, person: newPerson });
  } catch (error: unknown) {
    console.error('[api/people] POST error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

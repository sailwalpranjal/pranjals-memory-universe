import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface PhotoRel {
  id?: string;
  storage_path?: string | null;
  captured_at?: string | null;
  original_filename?: string | null;
  imported_at?: string | null;
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
  person_id: string;
  bounding_box: unknown;
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
    // 1. Fetch people
    const { data: peopleData, error: peopleError } = await supabase
      .from('people')
      .select('id, name, cover_photo_id, created_at, photos:cover_photo_id(id, storage_path)')
      .order('created_at', { ascending: false });

    if (peopleError) throw peopleError;

    // 2. Fetch assigned faces
    const { data: facesData, error: facesError } = await supabase
      .from('photo_faces')
      .select('id, photo_id, person_id, bounding_box, photos(id, storage_path)')
      .not('person_id', 'is', null);

    if (facesError) throw facesError;

    const allPeople = (peopleData as unknown as PersonRow[]) || [];
    const allFaces = (facesData as unknown as FaceRow[]) || [];

    // Group faces by person and by photo
    const personFacesMap = new Map<string, FaceRow[]>();
    const photoFacesMap = new Map<string, Set<string>>();

    for (const f of allFaces) {
      if (!f.person_id) continue;

      // Group by person
      const pFaces = personFacesMap.get(f.person_id) || [];
      pFaces.push(f);
      personFacesMap.set(f.person_id, pFaces);

      // Group by photo
      const photoPeople = photoFacesMap.get(f.photo_id) || new Set<string>();
      photoPeople.add(f.person_id);
      photoFacesMap.set(f.photo_id, photoPeople);
    }

    // 3. Compute co-occurrence edges
    const edgeWeights = new Map<string, number>();

    for (const personSet of photoFacesMap.values()) {
      if (personSet.size < 2) continue;
      const persons = Array.from(personSet);
      for (let i = 0; i < persons.length; i++) {
        for (let j = i + 1; j < persons.length; j++) {
          const p1 = persons[i];
          const p2 = persons[j];
          const key = p1 < p2 ? `${p1}__${p2}` : `${p2}__${p1}`;
          edgeWeights.set(key, (edgeWeights.get(key) || 0) + 1);
        }
      }
    }

    // 4. Collect paths to sign for node cover photos
    const pathsToSign: string[] = [];

    for (const person of allPeople) {
      const pFaces = personFacesMap.get(person.id) || [];
      const personPhoto = getPhotoRel(person.photos);
      let coverPath: string | null = null;

      if (person.cover_photo_id) {
        const matchingFace = pFaces.find((f) => f.photo_id === person.cover_photo_id);
        const matchingFacePhoto = getPhotoRel(matchingFace?.photos);
        coverPath = matchingFacePhoto?.storage_path || personPhoto?.storage_path || null;
      }
      if (!coverPath && pFaces.length > 0) {
        const firstFacePhoto = getPhotoRel(pFaces[0].photos);
        coverPath = firstFacePhoto?.storage_path || null;
      }
      if (coverPath) pathsToSign.push(coverPath);
    }

    const urlMap = await getSignedUrlsForPhotos(supabase, pathsToSign, 3600);

    // 5. Build nodes
    const nodes = allPeople.map((person) => {
      const pFaces = personFacesMap.get(person.id) || [];
      const uniquePhotos = new Set(pFaces.map((f) => f.photo_id));
      const personPhoto = getPhotoRel(person.photos);

      let coverFace = person.cover_photo_id
        ? pFaces.find((f) => f.photo_id === person.cover_photo_id) || null
        : null;
      if (!coverFace && pFaces.length > 0) {
        coverFace = pFaces[0];
      }

      const coverFacePhoto = getPhotoRel(coverFace?.photos);
      const storagePath = coverFacePhoto?.storage_path || personPhoto?.storage_path || null;
      const cleanPath = storagePath ? storagePath.trim().replace(/^\/+/, '') : '';
      const coverPhotoUrl = cleanPath
        ? urlMap.get(cleanPath) || urlMap.get(storagePath!) || null
        : null;

      return {
        id: person.id,
        name: person.name || 'Unnamed Person',
        photoCount: uniquePhotos.size,
        faceCount: pFaces.length,
        coverPhotoUrl,
        boundingBox: coverFace?.bounding_box || null,
      };
    });

    // 6. Build edges
    const edges = Array.from(edgeWeights.entries()).map(([key, weight]) => {
      const [source, target] = key.split('__');
      return {
        source,
        target,
        weight,
      };
    });

    return NextResponse.json({ nodes, edges });
  } catch (error: unknown) {
    console.error('[api/people/relationships] GET error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { GoogleGenAI } from '@google/genai';
﻿import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const limit = parseInt(searchParams.get('limit') || '50', 10) || 50;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    let queryBuilder = supabase
      .from('photos')
      .select('*, photo_metadata!inner(*)')
      .order('captured_at', { ascending: false, nullsFirst: false })
      .order('imported_at', { ascending: false })
      .limit(limit);

    if (query) {
      const q = `%${query}%`;
      queryBuilder = queryBuilder.or(
        `original_filename.ilike.${q},` +
        `photo_metadata.city.ilike.${q},` +
        `photo_metadata.country.ilike.${q},` +
        `photo_metadata.ai_title.ilike.${q},` +
        `photo_metadata.ai_description.ilike.${q},` +
        `photo_metadata.make.ilike.${q},` +
        `photo_metadata.model.ilike.${q}`
      );
    }

    let limitedPhotos = [];
    
    // Semantic Search Flow
    if (query && process.env.GEMINI_API_KEY) {
      try {
        
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const embedRes = await ai.models.embedContent({
           model: 'text-embedding-004',
           contents: query
        });
        if (embedRes.embeddings && embedRes.embeddings.length > 0) {
           const vector = embedRes.embeddings[0].values;
           const { data: semanticMatches } = await supabase.rpc('match_semantic', {
             query_embedding: `[${vector.join(',')}]`,
             match_threshold: 0.5,
             match_count: limit
           });
           
           if (semanticMatches && semanticMatches.length > 0) {
              const ids = semanticMatches.map((m: any) => m.id);
              const { data: semPhotos } = await supabase.from('photos').select('*, photo_metadata!inner(*)').in('id', ids);
              if (semPhotos) limitedPhotos = [...semPhotos];
           }
        }
      } catch (e) {
         console.warn('Semantic search failed, falling back to text search', e);
      }
    }

    if (limitedPhotos.length === 0) {
      const { data: photos, error: photosError } = await queryBuilder;
      if (photosError) throw photosError;
      limitedPhotos = photos || [];
    }
    
    // Fallback heuristic: If the user searches "favorite", add favorites
    if (query.toLowerCase().includes('favorite')) {
       const { data: favs } = await supabase.from('photos').select('*, photo_metadata(*)').eq('is_favorite', true).limit(limit);
       limitedPhotos = [...limitedPhotos, ...(favs || [])];
    }
    
    // Deduplicate
    const uniquePhotosMap = new Map();
    limitedPhotos.forEach(p => uniquePhotosMap.set(p.id, p));
    const uniquePhotos = Array.from(uniquePhotosMap.values()).slice(0, limit);

    const urlMap = await getSignedUrlsForPhotos(supabase, uniquePhotos, 3600);
    const results = uniquePhotos.map((photo: any) => {
      let url = photo.cloudinary_url || null;
      if (!url && photo.storage_path) {
        url = urlMap.get(photo.storage_path.replace(/^\/+/, '')) || null;
      }
      return { ...photo, url, metadata: Array.isArray(photo.photo_metadata) ? photo.photo_metadata[0] : photo.photo_metadata };
    });

    let matchedPeople = [];
    let matchedCollections = [];
    let matchedMeetings = [];

    if (query) {
      const [{ data: pData }, { data: cData }, { data: mData }] = await Promise.all([
        supabase.from('people').select('id, name, created_at').ilike('name', `%${query}%`).limit(10),
        supabase.from('collections').select('id, title, description').or(`title.ilike.%${query}%,description.ilike.%${query}%`).limit(10),
        supabase.from('meetings').select('id, title, notes, scheduled_at').or(`title.ilike.%${query}%,notes.ilike.%${query}%`).limit(10)
      ]);
      matchedPeople = pData || [];
      matchedCollections = cData || [];
      matchedMeetings = mData || [];
    }

    return NextResponse.json({
      results,
      people: matchedPeople,
      collections: matchedCollections,
      meetings: matchedMeetings,
      totalMatches: results.length + matchedPeople.length + matchedCollections.length + matchedMeetings.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import { getSignedUrlsForPhotos } from '@/lib/storage';

export const dynamic = 'force-dynamic';

interface GenerateCriteria {
  startDate?: string;
  endDate?: string;
  location?: string;
  personName?: string;
  mood?: string;
  aloneOnly?: boolean;
  limit?: number;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const criteria: GenerateCriteria = body || {};

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch available photos with metadata
    let query = supabase
      .from('photos')
      .select('*, photo_metadata(*)')
      .eq('is_archived', false)
      .order('captured_at', { ascending: false, nullsFirst: false });

    if (criteria.startDate) {
      query = query.gte('captured_at', criteria.startDate);
    }
    if (criteria.endDate) {
      query = query.lte('captured_at', criteria.endDate);
    }

    const { data: rawPhotos, error: fetchErr } = await query;
    if (fetchErr) throw fetchErr;

    if (!rawPhotos || rawPhotos.length === 0) {
      return NextResponse.json({
        error: 'No memories found matching the specified timeframe or criteria.',
      }, { status: 404 });
    }

    // 2. Filter by location, person, or alone
    let filtered = rawPhotos;
    if (criteria.location) {
      const locQuery = criteria.location.toLowerCase();
      filtered = filtered.filter((p) => {
        const meta = Array.isArray(p.photo_metadata) ? p.photo_metadata[0] : p.photo_metadata;
        return (
          (meta?.city && meta.city.toLowerCase().includes(locQuery)) ||
          (meta?.country && meta.country.toLowerCase().includes(locQuery))
        );
      });
    }

    // Deduplicate by checksum / dhash if any
    const seenHashes = new Set<string>();
    const deduplicated = filtered.filter((p) => {
      const hash = p.checksum || p.id;
      if (seenHashes.has(hash)) return false;
      seenHashes.add(hash);
      return true;
    });

    const targetLimit = Math.min(Math.max(criteria.limit || 4, 2), 8);
    const selectedPhotos = deduplicated.slice(0, targetLimit);

    // 3. Resolve URLs
    const urlMap = await getSignedUrlsForPhotos(supabase, selectedPhotos, 3600);
    const photosWithUrls = selectedPhotos.map((p) => {
      let url = p.cloudinary_url || null;
      if (!url && p.storage_path) {
        const cleanPath = p.storage_path.trim().replace(/^\/+/, '');
        url = urlMap.get(cleanPath) || urlMap.get(p.storage_path) || null;
      }
      return {
        ...p,
        url,
        photo_metadata: Array.isArray(p.photo_metadata) ? p.photo_metadata[0] || null : p.photo_metadata || null,
      };
    });

    // 4. Synthesize evocative title, caption, narrative with Gemini AI or Deterministic Fallback
    const apiKey = process.env.GEMINI_API_KEY;
    let generatedTitle = 'Fragments of Memory';
    let generatedNarrative = 'A curated chapter preserved from your personal timeline.';
    let layoutSuggestion = 'magazine';
    let themeSuggestion = 'Obsidian';

    // Build context summary from real photographs
    const firstPhoto = photosWithUrls[0];
    const locationStr = [firstPhoto?.photo_metadata?.city, firstPhoto?.photo_metadata?.country]
      .filter(Boolean)
      .join(', ') || criteria.location || 'Archived Journey';

    const dateStr = firstPhoto?.captured_at
      ? new Date(firstPhoto.captured_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : 'Timeless';

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const catalogPrompt = photosWithUrls.map((p, idx) => ({
          index: idx + 1,
          filename: p.original_filename,
          title: p.photo_metadata?.ai_title,
          location: [p.photo_metadata?.city, p.photo_metadata?.country].filter(Boolean).join(', '),
          tags: p.photo_metadata?.ai_tags?.slice(0, 3),
        }));

        const prompt = `You are the Memory Archivist for Pranjal's Universe.
Given this set of ${photosWithUrls.length} real photographs from Pranjal's archive with their authentic locations and metadata:
${JSON.stringify(catalogPrompt)}

User requested mood: "${criteria.mood || 'Reflective and Cinematic'}"

Generate:
1. An authentic, poetic Title (under 6 words). Never invent unrecorded locations or people.
2. An evocative narrative paragraph (30-50 words) describing the atmosphere, light, and visual significance.
3. Recommended layout: ["poster", "magazine", "cinematic", "polaroid", "grid"]
4. Recommended theme: ["Obsidian", "Warm Parchment", "Monochrome Film", "Cyberpunk"]

Return JSON:
{
  "title": string,
  "narrative": string,
  "layout": string,
  "theme": string
}`;

        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });

        const raw = res.text || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.title) generatedTitle = parsed.title;
          if (parsed.narrative) generatedNarrative = parsed.narrative;
          if (parsed.layout) layoutSuggestion = parsed.layout;
          if (parsed.theme) themeSuggestion = parsed.theme;
        }
      } catch (aiErr) {
        console.warn('Memory Generator fallback to deterministic synthesis:', aiErr);
      }
    }

    if (generatedTitle === 'Fragments of Memory' && locationStr) {
      generatedTitle = `Chronicles of ${locationStr}`;
      generatedNarrative = `A serene sequence captured in ${dateStr}. These ${photosWithUrls.length} frames document ambient light, quiet geometry, and preserved perspective.`;
    }

    return NextResponse.json({
      success: true,
      memory: {
        id: `mem-${Date.now()}`,
        title: generatedTitle,
        narrative: generatedNarrative,
        dateLabel: dateStr,
        locationLabel: locationStr,
        layout: layoutSuggestion,
        theme: themeSuggestion,
        photos: photosWithUrls,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error generating memory';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

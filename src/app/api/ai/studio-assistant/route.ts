import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

interface PhotoSummary {
  id: string;
  original_filename: string;
  ai_title?: string;
  city?: string;
  country?: string;
  tags?: string[];
  captured_at?: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { prompt, photos } = body as { prompt: string; photos: PhotoSummary[] };

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'Photos array is required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    // Deterministic Rule-Based Fallback Engine
    const fallbackLayout = () => {
      const lower = prompt.toLowerCase();
      let template = 'poster';
      let themeName = 'Obsidian';
      let title = 'Memories of Pranjal';
      let subtitle = 'Archival Collection';
      let spacing = 16;

      if (lower.includes('cinematic') || lower.includes('film') || lower.includes('movie')) {
        template = 'cinematic';
        themeName = 'Monochrome Film';
        title = 'Cinematic Vignettes';
        subtitle = 'Moments Captured in Motion';
        spacing = 8;
      } else if (lower.includes('minimal') || lower.includes('clean') || lower.includes('polaroid')) {
        template = 'polaroid';
        themeName = 'Warm Parchment';
        title = 'Fragments';
        subtitle = 'Notes from Yesterday';
        spacing = 24;
      } else if (lower.includes('magazine') || lower.includes('editorial') || lower.includes('story')) {
        template = 'magazine';
        themeName = 'Obsidian';
        title = 'The Chronicles';
        subtitle = 'Volume 1 — Curated Archive';
        spacing = 16;
      } else if (lower.includes('cyber') || lower.includes('night') || lower.includes('neon')) {
        template = 'grid';
        themeName = 'Cyberpunk';
        title = 'Neon Echoes';
        subtitle = 'Nocturnal Explorations';
        spacing = 12;
      } else if (lower.includes('compare') || lower.includes('before') || lower.includes('then and now')) {
        template = 'compare';
        themeName = 'Monochrome Film';
        title = 'Then & Now';
        subtitle = 'Parallel Perspectives';
        spacing = 16;
      }

      // Rank photos based on keyword matches with title, tags, or location
      const scored = photos.map((p) => {
        let score = 0;
        const text = [p.ai_title, p.city, p.country, ...(p.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        lower.split(/\s+/).forEach((word) => {
          if (word.length > 2 && text.includes(word)) score += 3;
        });
        return { photo: p, score };
      });

      scored.sort((a, b) => b.score - a.score);
      const selectedIds = scored.slice(0, Math.min(4, photos.length)).map((s) => s.photo.id);

      return {
        selectedPhotoIds: selectedIds,
        template,
        themeName,
        title,
        subtitle,
        borderSpacing: spacing,
        rationale: `Configured layout matching "${prompt}" from archive tags and timestamps.`,
      };
    };

    // If Gemini is configured, use Gemini 2.5 Flash for deep semantic reasoning
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = `You are the Creative Director of Pranjal's personal memory studio.
Given the user's creative prompt and a catalog of actual photos from Pranjal's archive, choose:
1. The most appropriate template from: ["poster", "magazine", "cinematic", "polaroid", "grid", "compare", "contact"]
2. The most suitable color theme from: ["Obsidian", "Warm Parchment", "Monochrome Film", "Cyberpunk"]
3. An evocative headline (title) and subtitle
4. Recommended spacing (number between 8 and 32)
5. The IDs of the 2 to 6 best matching photos from the catalog.

Return valid JSON with keys:
"selectedPhotoIds": string[],
"template": string,
"themeName": string,
"title": string,
"subtitle": string,
"borderSpacing": number,
"rationale": string

Do NOT invent photo IDs. Only use IDs from the provided catalog.`;

        const catalogJson = JSON.stringify(
          photos.slice(0, 30).map((p) => ({
            id: p.id,
            title: p.ai_title || p.original_filename,
            location: [p.city, p.country].filter(Boolean).join(', ') || undefined,
            tags: p.tags?.slice(0, 4),
          }))
        );

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: `${systemPrompt}\n\nUSER PROMPT: "${prompt}"\n\nPHOTO CATALOG:\n${catalogJson}`,
                },
              ],
            },
          ],
        });

        const rawText = response.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (Array.isArray(parsed.selectedPhotoIds) && parsed.selectedPhotoIds.length > 0) {
            // Verify all IDs exist in catalog
            const validIds = parsed.selectedPhotoIds.filter((id: string) =>
              photos.some((p) => p.id === id)
            );
            if (validIds.length > 0) {
              return NextResponse.json({
                ...parsed,
                selectedPhotoIds: validIds,
              });
            }
          }
        }
      } catch (aiErr) {
        console.warn('Gemini Studio Assistant fallback triggered:', aiErr);
      }
    }

    // Fallback if AI unavailable or parsing failed
    return NextResponse.json(fallbackLayout());
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { photoId } = await request.json();
    if (!photoId) return NextResponse.json({ error: 'photoId required' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'AI features not configured (Missing API Key)' }, { status: 501 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json({ error: 'Database configuration missing' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: photo, error } = await supabase
      .from('photos')
      .select('storage_path, mime_type')
      .eq('id', photoId)
      .single();

    if (error || !photo) throw new Error('Photo not found');

    const { data: fileData, error: fileError } = await supabase.storage
      .from('memories')
      .download(photo.storage_path);
      
    if (fileError || !fileData) throw new Error('Failed to download image data');
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        'You are an AI assisting in a personal memory archive. Look at this photograph. Return a JSON object with three fields: "title" (a poetic, short title max 4 words), "description" (a vivid, cinematic 2 sentence description), and "tags" (an array of 5 semantic keyword strings). ONLY return valid JSON.',
        {
          inlineData: {
            data: buffer.toString('base64'),
            mimeType: photo.mime_type || 'image/jpeg'
          }
        }
      ],
      config: {
        responseMimeType: 'application/json'
      }
    });

    if (!response.text) throw new Error('No AI response');
    
    let cleanText = response.text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    const aiData = JSON.parse(cleanText);

    const formattedAiData = {
      title: aiData.title || '',
      description: aiData.description || '',
      tags: Array.isArray(aiData.tags) ? aiData.tags : []
    };

    const { error: upsertError } = await supabase
      .from('photo_metadata')
      .upsert({
        photo_id: photoId,
        ai_title: formattedAiData.title,
        ai_description: formattedAiData.description,
        ai_tags: formattedAiData.tags
      }, { onConflict: 'photo_id' });

    if (upsertError) throw upsertError;

    return NextResponse.json({ success: true, ai: formattedAiData });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

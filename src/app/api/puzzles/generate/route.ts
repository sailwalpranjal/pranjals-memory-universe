import { NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { imageUrls } = await request.json();
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
      return NextResponse.json({ error: 'imageUrls array required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'AI features not configured' }, { status: 501 });

    const imageParts = [];
    for (const url of imageUrls) {
      if (!url) continue;
      const fileData = await fetch(url);
      if (!fileData.ok) continue;
      
      const arrayBuffer = await fileData.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const mimeType = fileData.headers.get('content-type') || 'image/jpeg';
      
      imageParts.push({
        inlineData: {
          data: buffer.toString('base64'),
          mimeType
        }
      });
    }

    if (imageParts.length === 0) {
      return NextResponse.json({ error: 'Could not fetch image data' }, { status: 400 });
    }

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        'You are an AI puzzle master. I am providing you with a set of images. Your task is to find a clever, semantic connection or common theme that unites all of these images. Return a JSON object with two fields: "connection" (a short, catchy phrase, max 5 words, describing the connection) and "explanation" (a brief 1-sentence explanation of how they connect). ONLY return valid JSON.',
        ...imageParts
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
    const result = JSON.parse(cleanText);

    return NextResponse.json({ success: true, connection: result.connection, explanation: result.explanation });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

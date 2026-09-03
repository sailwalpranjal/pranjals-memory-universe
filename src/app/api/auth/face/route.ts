import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { image } = await request.json(); // Expected to be base64 data URI

    if (!image) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    // Extract base64 part if it's a data URI
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const faceapi = require('@vladmandic/face-api');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Canvas, Image, ImageData, loadImage } = require('canvas');
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    const modelsPath = path.join(process.cwd(), 'public', 'models');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelsPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelsPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelsPath);

    const img = await loadImage(buffer);
    const detection = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();

    if (!detection) {
      return NextResponse.json({ error: 'No face detected' }, { status: 401 });
    }

    const descriptor = Array.from(detection.descriptor);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: matches, error } = await supabase.rpc('match_faces', {
      query_embedding: `[${descriptor.join(',')}]`,
      match_threshold: 0.5,
      match_count: 1,
    });

    if (error) {
      console.error('match_faces RPC error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (matches && matches.length > 0) {
      const match = matches[0];
      if (match.person_id) {
        // Check if the person is Pranjal (Admin)
        const { data: person } = await supabase
          .from('people')
          .select('name')
          .eq('id', match.person_id)
          .single();

        if (person && person.name === 'Pranjal (Admin)') {
          // It's the admin! Issue an auth cookie
          const cookieStore = cookies();
          cookieStore.set('admin_auth', 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 1 week
          });

          return NextResponse.json({
            success: true,
            isAdmin: true,
            personId: match.person_id,
            personName: person.name,
            confidence: match.confidence,
            similarity: match.similarity
          });
        }

        return NextResponse.json({
          success: true,
          isAdmin: false,
          personId: match.person_id,
          personName: person?.name || 'Unknown',
        });
      }
    }

    return NextResponse.json({ error: 'Face not recognized as Admin' }, { status: 401 });
  } catch (error: unknown) {
    console.error('[auth/face] Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

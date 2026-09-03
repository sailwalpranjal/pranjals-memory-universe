import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const { descriptor } = await request.json(); 

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json({ error: 'Invalid or missing facial descriptor' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: matches, error } = await supabase.rpc('match_faces', {
      query_embedding: \[\]\,
      match_threshold: 0.35,
      match_count: 1,
    });

    if (error) {
      console.error('match_faces RPC error:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    if (matches && matches.length > 0) {
      const match = matches[0];
      if (match.person_id) {
        const { data: person } = await supabase
          .from('people')
          .select('name')
          .eq('id', match.person_id)
          .single();

        if (person && person.name === 'Pranjal (Admin)') {
          const cookieStore = cookies();
          cookieStore.set('admin_auth', 'authenticated', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
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

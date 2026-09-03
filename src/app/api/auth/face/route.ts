import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export const dynamic = 'force-dynamic';

const rateLimitMap = new Map<string, { attempts: number; lockoutUntil: number }>();

export async function POST(request: Request) {
  try {
    const ip = request.headers.get('x-forwarded-for') || 'unknown';
    
    const now = Date.now();
    const limitRecord = rateLimitMap.get(ip) || { attempts: 0, lockoutUntil: 0 };
    
    if (now < limitRecord.lockoutUntil) {
      const waitMinutes = Math.ceil((limitRecord.lockoutUntil - now) / 60000);
      return NextResponse.json({ success: false, error: `Too many failed attempts. Try again in ${waitMinutes}m.` }, { status: 429 });
    }

    const { descriptor } = await request.json();

    if (!descriptor || !Array.isArray(descriptor) || descriptor.length !== 128) {
      return NextResponse.json({ success: false, error: 'Invalid descriptor' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: matches, error } = await supabase.rpc('match_faces', {
      query_embedding: `[${descriptor.join(',')}]`,
      match_threshold: 0.75,
      match_count: 1,
    });

    if (error) {
      console.error('match_faces error:', error);
      return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }

    if (matches && matches.length > 0) {
      const bestMatch = matches[0];
      
      const { data: person } = await supabase
        .from('people')
        .select('name')
        .eq('id', bestMatch.person_id)
        .single();

      if (person) {
        // Enforce strict threshold for Admin, but relaxed for Guests (since they weren't enrolled with high-res webcam)
        if (person.name === 'Pranjal (Admin)' && bestMatch.similarity < 0.92) {
            return NextResponse.json({ success: false, isAdmin: false, error: 'Identity Unknown - Admin threshold not met' }, { status: 401 });
        }
        
        rateLimitMap.delete(ip);
        
        if (person.name === 'Pranjal (Admin)') {
          cookies().delete('pranjal_guest_token');
          cookies().set('pranjal_admin_token', 'true', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
          });
          return NextResponse.json({ success: true, isAdmin: true, name: person.name, similarity: bestMatch.similarity });
        } else {
          cookies().delete('pranjal_admin_token');
          cookies().set('pranjal_guest_token', bestMatch.person_id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/',
          });
          return NextResponse.json({ success: true, isAdmin: false, isGuest: true, personId: bestMatch.person_id, name: person.name, similarity: bestMatch.similarity });
        }
      }
    }
    
    limitRecord.attempts += 1;
    if (limitRecord.attempts >= 5) {
      limitRecord.lockoutUntil = now + 15 * 60 * 1000;
    }
    rateLimitMap.set(ip, limitRecord);

    return NextResponse.json({ success: false, isAdmin: false, error: 'Identity Unknown' }, { status: 401 });
  } catch (err) {
    console.error('Face auth error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}


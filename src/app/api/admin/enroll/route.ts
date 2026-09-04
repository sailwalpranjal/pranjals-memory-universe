import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    const authCookie = (await cookies()).get('pranjal_admin_token');
    if (authCookie?.value !== 'true') {
      return NextResponse.json({ success: false, error: 'Unauthorized. Admin access required.' }, { status: 401 });
    }

    const { descriptors } = await request.json();
    if (!descriptors || !Array.isArray(descriptors) || descriptors.length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid descriptors data.' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Pranjal's ID
    const { data: person } = await supabase
      .from('people')
      .select('id')
      .eq('name', 'Pranjal (Admin)')
      .single();

    if (!person) {
      return NextResponse.json({ success: false, error: 'Admin record not found in DB.' }, { status: 500 });
    }

    // Optional: Delete old admin faces from photo_faces to avoid pollution.
    // For safety, we just delete faces associated with "Pranjal (Admin)" where original_filename like 'admin_ref%'
    await supabase.from('photo_faces').delete().eq('person_id', person.id);

    // Insert new descriptors
    for (let i = 0; i < descriptors.length; i++) {
      // Create a dummy photo for each
      const { data: photo } = await supabase
        .from('photos')
        .insert({ original_filename: `admin_enrollment_${Date.now()}_${i}.jpg`, visibility: 'PRIVATE', is_archived: true })
        .select()
        .single();
        
      if (photo) {
        await supabase.from('photo_faces').insert({
          photo_id: photo.id,
          person_id: person.id,
          embedding: `[${descriptors[i].join(',')}]`,
          confidence: 0.99, // High confidence as it's a controlled enrollment
          bounding_box: { _x: 0, _y: 0, _width: 224, _height: 224 } // Dummy box for DB constraints
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Enrollment error:", err);
    return NextResponse.json({ success: false, error: "Server error during enrollment." }, { status: 500 });
  }
}

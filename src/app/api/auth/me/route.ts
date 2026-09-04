import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function GET() {
  const adminToken = (await cookies()).get('pranjal_admin_token');
  const guestToken = (await cookies()).get('pranjal_guest_token');
  
  if (adminToken && adminToken.value === 'true') {
    return NextResponse.json({ name: 'Pranjal', role: 'admin' });
  } else if (guestToken && guestToken.value) {
    const { data } = await supabase.from('people').select('name').eq('id', guestToken.value).single();
    if (data) {
      return NextResponse.json({ name: data.name, role: 'guest' });
    }
  }
  
  return NextResponse.json({ name: 'Guest', role: null });
}

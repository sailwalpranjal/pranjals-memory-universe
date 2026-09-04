import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { verifyToken } from '@/lib/jwt';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
);

export async function GET() {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get('pranjal_admin_token');
  const guestToken = cookieStore.get('pranjal_guest_token');
  
  if (adminToken && adminToken.value === 'true') {
     cookieStore.delete('pranjal_admin_token');
  }

  if (adminToken && adminToken.value !== 'true') {
    const decoded = await verifyToken(adminToken.value);
    if (decoded && decoded.role === 'admin') {
      return NextResponse.json({ name: 'Pranjal', role: 'admin' });
    }
  }
  
  if (guestToken) {
    const decoded = await verifyToken(guestToken.value);
    if (decoded && decoded.role === 'guest') {
      const { data } = await supabase.from('people').select('name').eq('id', decoded.userId).single();
      if (data) {
        return NextResponse.json({ name: data.name, role: 'guest' });
      }
    }
  }
  
  return NextResponse.json({ name: 'Guest', role: null });
}

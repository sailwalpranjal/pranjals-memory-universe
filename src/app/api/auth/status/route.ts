import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const adminToken = (await cookies()).get('pranjal_admin_token');
  const guestToken = (await cookies()).get('pranjal_guest_token');
  
  if (adminToken && adminToken.value === 'true') {
    return NextResponse.json({ authenticated: true, role: 'admin' });
  } else if (guestToken && guestToken.value) {
    return NextResponse.json({ authenticated: true, role: 'guest', personId: guestToken.value });
  }
  
  return NextResponse.json({ authenticated: false, role: null });
}

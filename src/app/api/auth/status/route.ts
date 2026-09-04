import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/jwt';

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
      return NextResponse.json({ authenticated: true, role: 'admin' });
    }
  }
  
  if (guestToken) {
    const decoded = await verifyToken(guestToken.value);
    if (decoded && decoded.role === 'guest') {
      return NextResponse.json({ authenticated: true, role: 'guest', personId: decoded.userId });
    }
  }
  
  return NextResponse.json({ authenticated: false, role: null });
}

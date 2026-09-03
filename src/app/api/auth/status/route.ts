import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  const adminToken = cookies().get('pranjal_admin_token');
  return NextResponse.json({ authenticated: !!(adminToken && adminToken.value) });
}

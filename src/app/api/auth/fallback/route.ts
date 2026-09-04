import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { signToken } from '@/lib/jwt';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    const validPassword = process.env.ADMIN_FALLBACK_PASSWORD;
    
    if (!validPassword) {
      return NextResponse.json({ success: false, error: "Server configuration error. Fallback disabled." }, { status: 500 });
    }
    
    const cleanValid = validPassword.replace(/['"]/g, '').trim();
    const cleanInput = (password || '').trim();
    
    if (cleanInput === cleanValid) {
      const token = await signToken({ role: 'admin', userId: '00000000-0000-0000-0000-000000000000' });
      (await cookies()).set('pranjal_admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      return NextResponse.json({ success: true, isAdmin: true });
    }
    
    return NextResponse.json({ success: false, error: "Invalid credential" }, { status: 401 });
  } catch {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

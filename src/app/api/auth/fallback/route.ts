import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    const validPassword = process.env.ADMIN_FALLBACK_PASSWORD || "Pranjal@Admin2026!";
    
    if (password === validPassword) {
      cookies().set('admin_auth', 'true', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      return NextResponse.json({ success: true, isAdmin: true });
    }
    
    return NextResponse.json({ success: false, error: "Invalid credential" }, { status: 401 });
  } catch (err) {
    return NextResponse.json({ success: false, error: "Server error" }, { status: 500 });
  }
}

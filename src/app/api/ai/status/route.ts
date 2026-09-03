import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const configured = !!(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim().length > 0);
  return NextResponse.json({ configured });
}

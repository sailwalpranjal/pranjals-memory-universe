import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/jwt';

export async function middleware(request: NextRequest) {
  const adminCookie = request.cookies.get('pranjal_admin_token');
  const guestCookie = request.cookies.get('pranjal_guest_token');

  let isAdmin = false;
  let isGuest = false;

  if (adminCookie?.value) {
    const payload = await verifyToken(adminCookie.value);
    if (payload?.role === 'admin') isAdmin = true;
  }

  if (guestCookie?.value) {
    const payload = await verifyToken(guestCookie.value);
    if (payload?.role === 'guest') isGuest = true;
  }

  const { pathname } = request.nextUrl;

  // Protect API routes
  if (pathname.startsWith('/api')) {
    // Exempt public auth routes
    if (pathname.startsWith('/api/auth')) {
      return NextResponse.next();
    }
    
    // API routes require at least guest access, or admin for destructive actions.
    if (!isAdmin && !isGuest) {
      return NextResponse.json({ error: 'Unauthorized API Access' }, { status: 401 });
    }
    
    // Admin only API paths
    const adminApiPaths = ['/api/upload', '/api/photos/bulk', '/api/admin'];
    const isAdminApi = adminApiPaths.some(p => pathname.startsWith(p));
    
    if (isAdminApi && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden API Access' }, { status: 403 });
    }
    
    return NextResponse.next();
  }

  const adminOnlyPaths = [
    '/gallery',
    '/make',
    '/lab',
    '/settings',
    '/admin'
  ];
  
  const guestAllowedPaths = ['/timeline', '/meet', '/puzzles', '/people'];

  const isAdminOnly = adminOnlyPaths.some(path => pathname.startsWith(path));
  const isGuestAllowed = guestAllowedPaths.some(path => pathname.startsWith(path));

  if (isAdminOnly && !isAdmin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (isGuestAllowed && !isAdmin && !isGuest) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|models).*)',
  ],
};

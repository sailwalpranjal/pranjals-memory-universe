import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const adminCookie = request.cookies.get('pranjal_admin_token');
  const isAdmin = adminCookie?.value === 'true';

  const guestCookie = request.cookies.get('pranjal_guest_token');
  const isGuest = !!guestCookie?.value;

  const adminOnlyPaths = [
    '/gallery',
    '/make',
    '/lab',
    '/settings'
  ];
  
  const guestAllowedPaths = ['/timeline']; // Strictly restrict guests to their own timeline

  const { pathname } = request.nextUrl;

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
    '/((?!api|_next/static|_next/image|favicon.ico|models).*)',
  ],
};

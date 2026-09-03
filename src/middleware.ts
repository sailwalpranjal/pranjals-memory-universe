import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const adminCookie = request.cookies.get('admin_auth');
  const isAdmin = adminCookie?.value === 'authenticated';

  const protectedPaths = [
    '/gallery',
    '/timeline',
    '/make',
    '/lab',
    '/puzzles',
    '/collections',
    '/people',
    '/places',
    '/search',
    '/settings',
    '/meet'
  ];

  const { pathname } = request.nextUrl;

  const isProtectedPath = protectedPaths.some(path => pathname.startsWith(path));

  if (isProtectedPath && !isAdmin) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|models).*)',
  ],
};

import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];

export const middleware = (request: NextRequest) => {
  if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const sessionToken =
    request.cookies.get('better-auth.session_token') ??
    request.cookies.get('__Secure-better-auth.session_token');
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!sessionToken && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (sessionToken && pathname === '/login') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
};

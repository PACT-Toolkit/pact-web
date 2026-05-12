import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/verify-email',
  '/forgot-password',
  '/reset-password',
  // OAuth provider redirect target. Path shape is fixed by pact-auth's
  // provider config (internal/oauth/providers.go). Public so unauthenticated
  // users can complete sign-in.
  '/v1/auth/callback',
];

// Next.js 16 renamed `middleware` to `proxy`. Behavior is unchanged.
// This is the cheap edge-side gate — cookie-existence only, not the real
// auth barrier. requireSession() in app/(app)/layout.tsx is what actually
// validates against pact-auth.
export const proxy = (request: NextRequest) => {
  if (process.env.NEXT_PUBLIC_API_MOCKING === 'enabled') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('pact_session');
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!sessionToken && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
};

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
};

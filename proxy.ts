import { type NextRequest, NextResponse } from 'next/server';

import {
  clearSessionCookies,
  setSessionCookies,
} from '@/src/framework/auth/pact_auth/cookies';
import { isMock } from '@/src/framework/helpers/environment';
import { appendForwardedFor, inboundClientIp } from '@/src/lib/proxy/client_ip';
import { redeemRefreshToken } from '@/src/lib/proxy/refresh_session';
import { REFRESH_TOKEN_COOKIE, SESSION_COOKIE } from '@/src/lib/session_cookie';

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
//
// PACT-726: page navigations used to bounce straight to /login the moment
// pact_session expired (10 minutes - PACT_ENGINE's short-lived edge token),
// even though the far-longer-lived pact_refresh_token cookie (now 7 days,
// see REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS) and the pact-auth session behind
// it were both still good. Only the API proxy route (proxy_to_gateway.ts,
// PACT-705) ever redeemed that refresh token - a plain page load never hit
// it. This is the missing silent-renewal path for that case: no/expired
// pact_session but a present pact_refresh_token now gets one redemption
// attempt against pact-gateway's POST /v1/auth/session/refresh before
// falling back to /login.
//
// Design: this has to live here, not in session.ts's
// validateSessionFromCookies()/requireSession(). Those run inside Server
// Components, which cannot set cookies in Next.js 16 (see session.ts's own
// docblock) - so even if they redeemed a token there, the new pair could
// never be written back to the browser. Middleware is the only layer in the
// request lifecycle that can both read the inbound cookies and mutate the
// outbound response's Set-Cookie headers before the render happens.
//
// Runtime: this file declares no `runtime` export and next.config.ts has no
// `experimental.nodeMiddleware`, so it runs on the Edge runtime (Next.js
// 16.2.12 default). That's why redeemRefreshToken (src/lib/proxy) does a
// plain `fetch` instead of reusing src/framework/auth/pact_auth/client.ts -
// client.ts imports `next/headers`, which isn't callable from middleware.
//
// Race safety against proxy_to_gateway.ts's existing single-use-refresh-
// token rotation (PACT-705): the two mechanisms cannot race each other,
// structurally, not just by convention. proxy_to_gateway.ts only attaches
// X-Pact-Refresh-Token when a *session* cookie is present (it keys its own
// single-flight map on that cookie's value); the branch below only runs
// when the session cookie is *absent*. Those conditions are mutually
// exclusive on every request, so there is no request state in which both
// mechanisms could simultaneously try to redeem the same refresh token.
// Concurrent page navigations/prefetches that both find the session cookie
// missing (e.g. two tabs, or a `<Link>` prefetch racing the real
// navigation) are handled by redeemRefreshToken's own single-flight map,
// keyed on the refresh token value itself - same best-effort,
// single-runtime-instance guarantee proxy_to_gateway.ts's own map already
// has for its case, not a distributed lock.
export const proxy = async (request: NextRequest) => {
  if (isMock()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;

  if (sessionToken || isPublic) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  if (refreshToken) {
    const clientIp = appendForwardedFor(
      request.headers.get('x-forwarded-for'),
      inboundClientIp(request.headers)
    );
    const renewed = await redeemRefreshToken(refreshToken, clientIp);
    if (renewed) {
      // Make the fresh session token visible to the Server Component render
      // that follows in this same request (requireSession() reads it off
      // the inbound cookies), then also write it to the outbound response
      // so the browser picks it up for the next request.
      request.cookies.set(SESSION_COOKIE, renewed.sessionToken);
      const response = NextResponse.next({ request });
      setSessionCookies(response, renewed);

      return response;
    }
  }

  // No session, no (usable) refresh token: genuinely logged out, or the
  // refresh token was invalid/expired/already used. Clear both cookies -
  // a stale refresh token left behind is dead weight at best and, on the
  // reuse-detection path, actively wrong to keep presenting again.
  const redirectResponse = NextResponse.redirect(
    new URL('/login', request.url)
  );
  clearSessionCookies(redirectResponse);

  return redirectResponse;
};

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico|api/).*)'],
};

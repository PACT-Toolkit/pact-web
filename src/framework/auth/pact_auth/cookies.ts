import 'server-only';

import { type NextResponse } from 'next/server';

import { authCookieBaseOptions } from '@/src/lib/cookie_options';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE,
} from '@/src/lib/session_cookie';

import { type AuthSessionResult } from './client';

// Shared cookie names + option builders for the httpOnly cookies pact-web's
// auth routes write. Centralized so every route that hits the MFA step-up
// gate (password login, OAuth callback, password-reset confirm) sets the
// same cookie with the same semantics instead of re-deriving it per file.

export {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE,
};

export const MFA_TOKEN_COOKIE = 'pact_mfa_token';

// Signed OAuth state envelope minted by /api/auth/oauth/start and read
// back (then burned) by the /v1/auth/callback/{provider} handler.
export const OAUTH_STATE_COOKIE = 'pact_oauth_state';

// Carries the rebased return_to target across the /login/mfa step-up so
// the user lands back on their original deep link once they clear the
// second factor. Set only on the OAuth-callback MFA branch; absent for
// password-login MFA, which always resumes at /dashboard.
export const OAUTH_RETURN_TO_COOKIE = 'pact_oauth_return_to';

// pact-auth issues MFA challenge tokens with a 5-minute TTL (see
// internal/mfa/service.go::challengeTTL). Every step-up cookie caps its
// maxAge to the same window so a stale browser tab can't sit forever on the
// step-up form holding a token that's already invalid server-side.
export const MFA_TOKEN_TTL_SECONDS = 5 * 60;

// Options for the short-lived, one-shot MFA step-up cookie (and, on the
// OAuth callback, the sibling pending-return_to cookie). httpOnly,
// sameSite=lax, capped to the MFA challenge TTL by default.
export const shortLivedCookieOptions = (maxAge: number) => ({
  ...authCookieBaseOptions(),
  maxAge,
});

// Options for the long-lived session cookie every login-completing route
// writes (password login, MFA verify, passkey login, password-reset
// confirm, email verify, OAuth callback), expiring in lockstep with the
// pact-auth session it carries.
export const sessionCookieOptions = (expires: Date) => ({
  ...authCookieBaseOptions(),
  expires,
});

// See REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS's own doc comment
// (src/lib/session_cookie.ts) for why this doesn't mirror
// sessionCookieOptions' expiry.
export const refreshTokenCookieOptions = () => ({
  ...authCookieBaseOptions(),
  maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS,
});

// Writes both the session cookie and (when present) the refresh-token
// cookie from a pact-auth session result. Every route that completes a
// login (password, MFA verify, passkey, OAuth callback, password-reset
// confirm, email verify) mints a session the same way pact-gateway's
// authMiddleware later needs to silently renew, so this is the single
// place that pairs the two writes - PACT-705 exists because refreshToken
// used to be parsed and dropped here.
export const setSessionCookies = (
  res: NextResponse,
  session: Pick<
    AuthSessionResult,
    'sessionToken' | 'refreshToken' | 'expiresAtUnix'
  >
): void => {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: session.sessionToken,
    ...sessionCookieOptions(new Date(session.expiresAtUnix * 1000)),
  });
  if (session.refreshToken) {
    res.cookies.set({
      name: REFRESH_TOKEN_COOKIE,
      value: session.refreshToken,
      ...refreshTokenCookieOptions(),
    });
  }
};

// Clears both cookies on sign-out. Mirrors setSessionCookies so the pair is
// always managed together.
export const clearSessionCookies = (res: NextResponse): void => {
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    ...authCookieBaseOptions(),
    maxAge: 0,
  });
  res.cookies.set({
    name: REFRESH_TOKEN_COOKIE,
    value: '',
    ...authCookieBaseOptions(),
    maxAge: 0,
  });
};

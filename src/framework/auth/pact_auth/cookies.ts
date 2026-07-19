import 'server-only';

// Shared cookie names + option builders for the httpOnly cookies pact-web's
// auth routes write. Centralized so every route that hits the MFA step-up
// gate (password login, OAuth callback, password-reset confirm) sets the
// same cookie with the same semantics instead of re-deriving it per file.

export { SESSION_COOKIE } from '@/src/lib/session_cookie';

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
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge,
});

// Options for the long-lived session cookie every login-completing route
// writes (password login, MFA verify, passkey login, password-reset
// confirm, email verify, OAuth callback), expiring in lockstep with the
// pact-auth session it carries.
export const sessionCookieOptions = (expires: Date) => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  expires,
});

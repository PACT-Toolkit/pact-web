import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { isMock, MOCK_USER_ID } from '@/src/framework/helpers/environment';

import { getPactAuthClient } from './client';

const SESSION_COOKIE = 'pact_session';

// One-year horizon, recomputed at module load. Far enough out that nothing
// in the UI treats the session as "about to expire" during a dev:mock run.
const MOCK_SESSION_EXPIRES_AT = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

export type Session = {
  userId: string;
  expiresAt: Date;
};

// Server-side session validation. Calls pact-auth.ValidateSession on every
// invocation — fail-closed by design. Cookie-existence checks in middleware
// are an Edge-runtime optimization, not the security barrier; this is.
//
// On failure (no cookie, invalid token, or pact-auth unreachable) the user
// is redirected to /login. We don't proactively clear the bad cookie here
// because Server Components can't mutate cookies in Next.js 16 — the cookie
// is harmless (we never trust its value, only what ValidateSession says
// about it) and will be overwritten on the next successful login.
//
// Use from any Server Component or layout under app/(app). Don't call from
// route handlers that need to surface domain errors to the client — they
// should call validateSessionFromCookies() and decide their own response.
export const requireSession = async (): Promise<Session> => {
  const session = await validateSessionFromCookies();
  if (!session) {
    redirect('/login');
  }

  return session;
};

// Lower-level: returns the session if valid, or null. Doesn't redirect or
// mutate cookies. Useful for layouts that want to render a logged-out view
// vs. a logged-in view in the same component tree.
export const validateSessionFromCookies = async (): Promise<Session | null> => {
  if (isMock()) {
    // Auto-login in `pnpm run dev:mock` — no cookie required, no pact-auth
    // roundtrip.
    return { userId: MOCK_USER_ID, expiresAt: MOCK_SESSION_EXPIRES_AT };
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let resp;
  try {
    resp = await getPactAuthClient().validateSession({ sessionToken: token });
  } catch {
    // Network blip or pact-auth down. Fail closed — treat as no session.
    return null;
  }
  if (!resp.valid || !resp.userId) return null;

  return {
    userId: resp.userId,
    expiresAt: new Date(Number(resp.expiresAtUnix) * 1000),
  };
};

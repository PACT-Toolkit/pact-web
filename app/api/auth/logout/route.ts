import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import { SESSION_COOKIE } from '@/src/framework/auth/pact_auth/cookies';

export const runtime = 'nodejs';

// Idempotent. Safe to call without a session — we just clear the cookie.
// Best-effort RevokeSession: any failure here (network blip, expired token)
// shouldn't block the user from logging out, so we swallow it. The cookie
// clear below is what actually ends the user-visible session.
export const POST = async (req: NextRequest) => {
  const token = req.cookies.get(SESSION_COOKIE)?.value;

  if (token) {
    try {
      await getPactAuthClient().revokeSession({ sessionToken: token });
    } catch {
      // intentional: see comment above
    }
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return res;
};

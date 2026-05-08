import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';
const FALLBACK_RETURN_TO = '/dashboard';

// GET /api/auth/verify-email?token=<token>
// Called by the link in the verification email. On success: set
// pact_session, redirect to return_to (validated server-side by pact-auth's
// allowlist, then echoed back). On failure: redirect to /verify-email/failed
// with a reason in the query string.
export const GET = async (req: NextRequest) => {
  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(
      new URL('/verify-email/failed?reason=missing_token', req.url)
    );
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['verifyEmail']>
  >;
  try {
    resp = await getPactAuthClient().verifyEmail({ token });
  } catch (err) {
    const reason =
      err instanceof ConnectError && err.code === Code.Unauthenticated
        ? 'invalid_or_expired'
        : 'server_error';

    return NextResponse.redirect(
      new URL(`/verify-email/failed?reason=${reason}`, req.url)
    );
  }

  // pact-auth echoes back the same return_to it stored at register time,
  // already validated against the allowlist. Treat it as opaque-but-trusted.
  const returnTo = resp.returnTo || FALLBACK_RETURN_TO;
  const target = (() => {
    try {
      // Absolute URL from pact-auth's allowlist — use as-is.
      return new URL(returnTo);
    } catch {
      // Relative — resolve against the request origin.
      return new URL(returnTo, req.url);
    }
  })();

  const expiresAt = new Date(Number(resp.expiresAtUnix) * 1000);
  const res = NextResponse.redirect(target);
  res.cookies.set({
    name: SESSION_COOKIE,
    value: resp.sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return res;
};

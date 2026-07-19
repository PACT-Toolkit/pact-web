import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/src/framework/auth/pact_auth/cookies';
import {
  rebaseReturnTo,
  requestOrigin,
} from '@/src/framework/auth/pact_auth/return_to';

export const runtime = 'nodejs';

const FALLBACK_RETURN_TO = '/dashboard';

// GET /api/auth/verify-email?token=<token>
// Called by the link in the verification email. On success: set
// pact_session, redirect to /verify-email/success which shows a brief
// confirmation and forwards to the user's return_to. On failure:
// redirect to /verify-email/failed with a reason in the query string.
//
// Going via /verify-email/success (rather than straight to the
// return_to) gives the user a clear "Email verified" beat after the
// click, which is especially nice on mobile where the verify click
// might happen on a different device than the dashboard.
export const GET = async (req: NextRequest) => {
  // Build all redirects against the inbound request's actual origin so
  // a phone clicking the email link is sent to a URL the phone can
  // reach (Next.js's `req.url` is sticky to the listener bind in dev).
  const origin = requestOrigin(req);

  const token = req.nextUrl.searchParams.get('token');
  if (!token) {
    return NextResponse.redirect(
      new URL('/verify-email/failed?reason=missing_token', origin)
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
      new URL(`/verify-email/failed?reason=${reason}`, origin)
    );
  }

  // pact-auth echoes back the same return_to it stored at register time
  // and validated against the allowlist. Rebase the host onto the
  // inbound request's origin so "register on laptop, click email on
  // phone" lands the phone on a URL the phone can actually reach — the
  // path part is what carries the user's intent ("go to /dashboard"),
  // not the host. We only forward the path + query to the success
  // page: the success page is same-origin and accepting absolute URLs
  // there would turn a hand-crafted /verify-email/success?next=… link
  // into an open redirect.
  const rebased = rebaseReturnTo(req, resp.returnTo || FALLBACK_RETURN_TO);
  const nextPath =
    rebased.origin === origin
      ? rebased.pathname + rebased.search
      : FALLBACK_RETURN_TO;

  const success = new URL('/verify-email/success', origin);
  success.searchParams.set('next', nextPath);

  const expiresAt = new Date(Number(resp.expiresAtUnix) * 1000);
  const res = NextResponse.redirect(success);
  res.cookies.set({
    name: SESSION_COOKIE,
    value: resp.sessionToken,
    ...sessionCookieOptions(expiresAt),
  });

  return res;
};

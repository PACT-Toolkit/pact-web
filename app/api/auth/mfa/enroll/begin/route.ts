import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

// POST /api/auth/mfa/enroll/begin
//
// Provisions a pending TOTP factor and hands the user-facing secret /
// otpauth URL back to the client so the UI can render a QR code (or
// fall back to manual entry into an authenticator app).
//
// The session token is read from the httpOnly pact_session cookie —
// never trust a body-supplied token on an enrollment endpoint.
//
// The factor remains in the "pending" state (verified=false) until the
// caller round-trips a valid 6-digit code through
// /api/auth/mfa/enroll/confirm. Abandoning the flow leaves a pending
// row server-side that pact-auth's enrollment quota and TTL clean up
// — see internal/mfa/service.go.
export const POST = async () => {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['beginTOTPEnrollment']>
  >;
  try {
    resp = await getPactAuthClient().beginTOTPEnrollment({ sessionToken });
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.Unauthenticated:
          return NextResponse.json(
            { error: 'session expired' },
            { status: 401 }
          );
        case Code.ResourceExhausted:
          return NextResponse.json(
            {
              error: 'too many attempts, try again later',
              code: 'rate_limited',
            },
            { status: 429 }
          );
        case Code.FailedPrecondition:
          // A verified TOTP factor already exists for this user.
          return NextResponse.json(
            { error: 'already enrolled', code: 'already_enrolled' },
            { status: 409 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'could not start TOTP enrollment' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    factorId: resp.factorId,
    secret: resp.secret,
    otpauthUrl: resp.otpauthUrl,
  });
};

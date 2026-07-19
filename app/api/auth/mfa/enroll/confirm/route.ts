import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import {
  getSessionToken,
  invalidJsonResponse,
  isString,
  notSignedInResponse,
  readJsonBody,
  sessionExpiredResponse,
} from '@/src/framework/auth/pact_auth/route_helpers';

export const runtime = 'nodejs';

type Body = { factorId?: unknown; code?: unknown };

// POST /api/auth/mfa/enroll/confirm
// Body: { factorId, code }   — `code` is the 6-digit TOTP from the user's
//                              authenticator app
// Returns: { recoveryCodes: string[] }
//
// On success pact-auth flips the pending factor to verified and rotates
// a fresh batch of recovery codes. The caller MUST display these once
// and prompt the user to save them — pact-web never persists or surfaces
// them again. Users who lose them can regenerate via
// /api/auth/mfa/recovery-codes (which invalidates the prior batch).
export const POST = async (req: NextRequest) => {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    return notSignedInResponse();
  }

  const body = await readJsonBody<Body>(req);
  if (body === null) {
    return invalidJsonResponse();
  }

  if (!isString(body.factorId) || !body.factorId) {
    return NextResponse.json(
      { error: 'factorId is required' },
      { status: 400 }
    );
  }
  // Cheap client-side guard so we don't burn a server round-trip on
  // obviously malformed input. pact-auth re-validates server-side.
  if (!isString(body.code) || !/^\d{6}$/.test(body.code)) {
    return NextResponse.json(
      { error: 'code must be 6 digits', code: 'invalid_code' },
      { status: 400 }
    );
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['confirmTOTPEnrollment']>
  >;
  try {
    resp = await getPactAuthClient().confirmTOTPEnrollment({
      sessionToken,
      factorId: body.factorId,
      code: body.code,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.Unauthenticated:
          return sessionExpiredResponse();
        case Code.InvalidArgument:
          return NextResponse.json(
            { error: 'invalid code', code: 'invalid_code' },
            { status: 400 }
          );
        case Code.NotFound:
          return NextResponse.json(
            { error: 'enrollment not found', code: 'not_found' },
            { status: 404 }
          );
        case Code.ResourceExhausted:
          return NextResponse.json(
            {
              error: 'too many attempts, try again later',
              code: 'rate_limited',
            },
            { status: 429 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'could not confirm enrollment' },
      { status: 500 }
    );
  }

  return NextResponse.json({ recoveryCodes: resp.recoveryCodes });
};

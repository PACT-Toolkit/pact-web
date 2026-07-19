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

type Body = { factorId?: unknown };

// POST /api/auth/mfa/revoke
// Body: { factorId }
// Calls pact-auth.RevokeMfaFactor with the cookie-bound session token.
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

  try {
    await getPactAuthClient().revokeMfaFactor({
      sessionToken,
      factorId: body.factorId,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.Unauthenticated:
          return sessionExpiredResponse();
        case Code.NotFound:
          return NextResponse.json(
            { error: 'factor not found' },
            { status: 404 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'could not revoke factor' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

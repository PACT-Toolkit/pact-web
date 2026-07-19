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

type Body = { passkeyId?: unknown };

// POST /api/auth/passkey/delete
// Body: { passkeyId }
// Soft-deletes the passkey. We keep this as POST (not DELETE) for parity
// with the rest of the auth API — every other proxy route is POST and
// the common fetch wrapper assumes JSON-in/JSON-out POST.
export const POST = async (req: NextRequest) => {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    return notSignedInResponse();
  }

  const body = await readJsonBody<Body>(req);
  if (body === null) {
    return invalidJsonResponse();
  }
  if (!isString(body.passkeyId) || !body.passkeyId) {
    return NextResponse.json(
      { error: 'passkeyId is required' },
      { status: 400 }
    );
  }

  try {
    await getPactAuthClient().deletePasskey({
      sessionToken,
      passkeyId: body.passkeyId,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.Unauthenticated:
          return sessionExpiredResponse();
        case Code.NotFound:
          return NextResponse.json(
            { error: 'passkey not found' },
            { status: 404 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'could not delete passkey' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

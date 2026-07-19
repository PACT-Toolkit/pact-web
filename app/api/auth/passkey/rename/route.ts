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

const MAX_LABEL = 64;

type Body = { passkeyId?: unknown; label?: unknown };

// POST /api/auth/passkey/rename
// Body: { passkeyId, label }
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
  const label = isString(body.label) ? body.label.trim() : '';
  if (!label) {
    return NextResponse.json({ error: 'label is required' }, { status: 400 });
  }
  if (label.length > MAX_LABEL) {
    return NextResponse.json(
      { error: `label is too long (max ${MAX_LABEL} characters)` },
      { status: 400 }
    );
  }

  try {
    await getPactAuthClient().renamePasskey({
      sessionToken,
      passkeyId: body.passkeyId,
      label,
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
        case Code.AlreadyExists:
          return NextResponse.json(
            { error: 'a passkey with that name already exists' },
            { status: 409 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'could not rename passkey' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

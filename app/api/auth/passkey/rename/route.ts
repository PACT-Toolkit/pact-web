import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';
const MAX_LABEL = 64;

type Body = { passkeyId?: unknown; label?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// POST /api/auth/passkey/rename
// Body: { passkeyId, label }
export const POST = async (req: NextRequest) => {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
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
          return NextResponse.json(
            { error: 'session expired' },
            { status: 401 }
          );
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

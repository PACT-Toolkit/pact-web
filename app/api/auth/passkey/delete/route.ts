import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

type Body = { passkeyId?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// POST /api/auth/passkey/delete
// Body: { passkeyId }
// Soft-deletes the passkey. We keep this as POST (not DELETE) for parity
// with the rest of the auth API — every other proxy route is POST and
// the common fetch wrapper assumes JSON-in/JSON-out POST.
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

  try {
    await getPactAuthClient().deletePasskey({
      sessionToken,
      passkeyId: body.passkeyId,
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

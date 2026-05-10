import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

type Body = { factorId?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// POST /api/auth/mfa/revoke
// Body: { factorId }
// Calls pact-auth.RevokeMfaFactor with the cookie-bound session token.
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
          return NextResponse.json(
            { error: 'session expired' },
            { status: 401 }
          );
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

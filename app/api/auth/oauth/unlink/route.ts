import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';
const ALLOWED_PROVIDERS = new Set(['github', 'google', 'meta']);

type Body = { provider?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// POST /api/auth/oauth/unlink
// Body: { provider }
// Refuses if it would leave the user with no other sign-in method —
// surfaced as HTTP 409 so the UI can render a "set a password / add a
// passkey first" hint instead of a generic error.
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
  if (!isString(body.provider) || !ALLOWED_PROVIDERS.has(body.provider)) {
    return NextResponse.json({ error: 'invalid provider' }, { status: 400 });
  }

  try {
    await getPactAuthClient().unlinkIdentity({
      sessionToken,
      provider: body.provider,
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
            { error: 'provider not connected' },
            { status: 404 }
          );
        case Code.FailedPrecondition:
          return NextResponse.json(
            {
              error:
                'this is your only sign-in method; add a password or passkey before disconnecting',
              code: 'last_sign_in_method',
            },
            { status: 409 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'could not disconnect provider' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
};

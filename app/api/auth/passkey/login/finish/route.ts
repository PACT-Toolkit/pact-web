import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

type Body = { ceremonyId?: unknown; assertion?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// POST /api/auth/passkey/login/finish
// Body: { ceremonyId, assertion }
// Sets the pact_session cookie on success, mirroring /api/auth/login.
//
// Anti-enumeration: pact-auth maps "no such credential" / "bad signature" /
// "expired ceremony" all to Unauthenticated. We pass that through as a single
// generic 401 rather than discriminating, so a stranger probing the endpoint
// can't learn whether a credential exists.
export const POST = async (req: NextRequest) => {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  if (!isString(body.ceremonyId) || !body.ceremonyId) {
    return NextResponse.json(
      { error: 'ceremonyId is required' },
      { status: 400 }
    );
  }
  if (!body.assertion || typeof body.assertion !== 'object') {
    return NextResponse.json(
      { error: 'assertion is required' },
      { status: 400 }
    );
  }

  const assertionJson = new TextEncoder().encode(
    JSON.stringify(body.assertion)
  );

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['finishPasskeyLogin']>
  >;
  try {
    resp = await getPactAuthClient().finishPasskeyLogin({
      ceremonyId: body.ceremonyId,
      assertionJson,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.Unauthenticated:
          return NextResponse.json(
            { error: 'passkey sign-in failed' },
            { status: 401 }
          );
        case Code.InvalidArgument:
          return NextResponse.json({ error: err.rawMessage }, { status: 400 });
        case Code.ResourceExhausted:
          return NextResponse.json(
            { error: 'too many attempts, try again later' },
            { status: 429 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'passkey sign-in failed' },
      { status: 500 }
    );
  }

  const expiresAt = new Date(Number(resp.expiresAtUnix) * 1000);
  const res = NextResponse.json({ ok: true, userId: resp.userId });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: resp.sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });

  return res;
};

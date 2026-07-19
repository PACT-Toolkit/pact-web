import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import {
  SESSION_COOKIE,
  sessionCookieOptions,
} from '@/src/framework/auth/pact_auth/cookies';
import {
  invalidJsonResponse,
  isString,
  readJsonBody,
} from '@/src/framework/auth/pact_auth/route_helpers';

export const runtime = 'nodejs';

type Body = { ceremonyId?: unknown; assertion?: unknown };

// POST /api/auth/passkey/login/finish
// Body: { ceremonyId, assertion }
// Sets the pact_session cookie on success, mirroring /api/auth/login.
//
// Anti-enumeration: pact-auth maps "no such credential" / "bad signature" /
// "expired ceremony" all to Unauthenticated. We pass that through as a single
// generic 401 rather than discriminating, so a stranger probing the endpoint
// can't learn whether a credential exists.
export const POST = async (req: NextRequest) => {
  const body = await readJsonBody<Body>(req);
  if (body === null) {
    return invalidJsonResponse();
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
    ...sessionCookieOptions(expiresAt),
  });

  return res;
};

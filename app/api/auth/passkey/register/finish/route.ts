import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

type Body = { ceremonyId?: unknown; attestation?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

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

  if (!isString(body.ceremonyId) || !body.ceremonyId) {
    return NextResponse.json(
      { error: 'ceremonyId is required' },
      { status: 400 }
    );
  }
  if (!body.attestation || typeof body.attestation !== 'object') {
    return NextResponse.json(
      { error: 'attestation is required' },
      { status: 400 }
    );
  }

  const attestationJson = new TextEncoder().encode(
    JSON.stringify(body.attestation)
  );

  let resp: Awaited<
    ReturnType<
      ReturnType<typeof getPactAuthClient>['finishPasskeyRegistration']
    >
  >;
  try {
    resp = await getPactAuthClient().finishPasskeyRegistration({
      sessionToken,
      ceremonyId: body.ceremonyId,
      attestationJson,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.Unauthenticated:
          return NextResponse.json(
            { error: 'session expired' },
            { status: 401 }
          );
        case Code.InvalidArgument:
          return NextResponse.json({ error: err.rawMessage }, { status: 400 });
        case Code.AlreadyExists:
          return NextResponse.json(
            { error: 'this passkey is already registered' },
            { status: 409 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'could not finish passkey enrollment' },
      { status: 500 }
    );
  }

  return NextResponse.json({ credentialId: resp.credentialId });
};

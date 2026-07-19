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

type Body = { ceremonyId?: unknown; attestation?: unknown };

export const POST = async (req: NextRequest) => {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    return notSignedInResponse();
  }

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
          return sessionExpiredResponse();
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

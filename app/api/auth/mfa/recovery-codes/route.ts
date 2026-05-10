import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

// POST /api/auth/mfa/recovery-codes
// Generates a fresh batch of recovery codes; the previous batch is invalidated
// server-side. Codes are returned only here — we never persist them client-side
// or surface them again, so the caller MUST display them once and prompt the
// user to copy/print/save them before navigating away.
export const POST = async () => {
  const sessionToken = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!sessionToken) {
    return NextResponse.json({ error: 'not signed in' }, { status: 401 });
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['regenerateRecoveryCodes']>
  >;
  try {
    resp = await getPactAuthClient().regenerateRecoveryCodes({ sessionToken });
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.Unauthenticated:
          return NextResponse.json(
            { error: 'session expired' },
            { status: 401 }
          );
        case Code.FailedPrecondition:
          return NextResponse.json(
            { error: 'enroll a TOTP factor before generating recovery codes' },
            { status: 409 }
          );
        default:
          break;
      }
    }

    return NextResponse.json(
      { error: 'could not regenerate recovery codes' },
      { status: 500 }
    );
  }

  return NextResponse.json({ recoveryCodes: resp.recoveryCodes });
};

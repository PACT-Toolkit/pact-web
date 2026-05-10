import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

type Body = { email?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// POST /api/auth/passkey/login/begin
// Body: { email?: string }
// Returns: { ceremonyId, options }   ← options is the WebAuthn JSON envelope
//
// pact-auth returns options_json as raw bytes (a JSON document with
// base64url-encoded binary fields per the WebAuthn JSON spec). We parse and
// re-emit as JSON so the browser can hand it directly to navigator.credentials.get
// after decoding the binary fields locally.
export const POST = async (req: NextRequest) => {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const email = isString(body.email) ? body.email : '';

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['beginPasskeyLogin']>
  >;
  try {
    resp = await getPactAuthClient().beginPasskeyLogin({ email });
  } catch (err) {
    if (err instanceof ConnectError && err.code === Code.ResourceExhausted) {
      return NextResponse.json(
        { error: 'too many attempts, try again later' },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: 'could not start passkey sign-in' },
      { status: 500 }
    );
  }

  let options: unknown;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(resp.optionsJson)) as
      | { publicKey?: unknown }
      | unknown;
    // go-webauthn marshals CredentialAssertion as { publicKey: {...}, mediation? }.
    // Unwrap so the browser-side decoder reads challenge/allowCredentials
    // directly off the top.
    options =
      parsed && typeof parsed === 'object' && 'publicKey' in parsed
        ? (parsed as { publicKey: unknown }).publicKey
        : parsed;
  } catch {
    return NextResponse.json(
      { error: 'invalid passkey options' },
      { status: 502 }
    );
  }

  return NextResponse.json({ ceremonyId: resp.ceremonyId, options });
};

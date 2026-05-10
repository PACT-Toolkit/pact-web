import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

type Body = { label?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// POST /api/auth/passkey/register/begin
// Body: { label: string }
// Returns: { ceremonyId, options }
//
// Reads the session token from the httpOnly pact_session cookie — never trust
// a session token in the request body for an enrollment endpoint.
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

  const rawLabel = isString(body.label) ? body.label.trim() : '';
  // Default to a generic label so users who skip the input still get a sane
  // entry in their authenticator list. The settings page lets them rename
  // later (TODO: once a passkey rename RPC lands).
  const label = rawLabel.length > 0 ? rawLabel.slice(0, 64) : 'Passkey';

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['beginPasskeyRegistration']>
  >;
  try {
    resp = await getPactAuthClient().beginPasskeyRegistration({
      sessionToken,
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
      { error: 'could not start passkey enrollment' },
      { status: 500 }
    );
  }

  let options: unknown;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(resp.optionsJson)) as
      | { publicKey?: unknown }
      | unknown;
    // go-webauthn marshals CredentialCreation as { publicKey: {...}, mediation? }.
    // Unwrap so the browser-side decoder reads challenge/user/pubKeyCredParams
    // directly off the top — saves it from juggling either shape.
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

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

type Body = { label?: unknown };

// POST /api/auth/passkey/register/begin
// Body: { label: string }
// Returns: { ceremonyId, options }
//
// Reads the session token from the httpOnly pact_session cookie — never trust
// a session token in the request body for an enrollment endpoint.
export const POST = async (req: NextRequest) => {
  const sessionToken = await getSessionToken();
  if (!sessionToken) {
    return notSignedInResponse();
  }

  const body = await readJsonBody<Body>(req);
  if (body === null) {
    return invalidJsonResponse();
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
          return sessionExpiredResponse();
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

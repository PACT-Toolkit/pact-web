import { Code, ConnectError } from '@connectrpc/connect';
import { NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import { mapPactAuthError } from '@/src/framework/auth/pact_auth/errors';
import {
  challengeExpiredResponse,
  getMfaToken,
  noMfaChallengeResponse,
  parseCeremonyOptions,
} from '@/src/framework/auth/pact_auth/route_helpers';

export const runtime = 'nodejs';

// POST /api/auth/mfa/passkey/begin
// No body - the mfa_token comes off the same httpOnly pact_mfa_token
// cookie /api/auth/mfa/verify reads. Starts a WebAuthn assertion ceremony
// scoped to that token's owner, as an alternative to submitting a
// TOTP/recovery code (PACT-697).
// Returns: { ceremonyId, options }
export const POST = async () => {
  const mfaToken = await getMfaToken();
  if (!mfaToken) {
    return noMfaChallengeResponse();
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['beginMfaPasskey']>
  >;
  try {
    resp = await getPactAuthClient().beginMfaPasskey({ mfaToken });
  } catch (err) {
    // BeginMfaPasskeyAssertion only reads the challenge (GetChallengeUserID),
    // never consumes it - so the one Unauthenticated outcome it can raise is
    // always "the challenge itself is already dead" (mfa.ErrChallengeInvalid),
    // unlike the finish route below which also has to distinguish a
    // verification failure. See BeginMfaPasskeyAssertion's docblock in
    // pact-auth/internal/features/mfa/handler.go.
    if (err instanceof ConnectError && err.code === Code.Unauthenticated) {
      return challengeExpiredResponse();
    }

    const { status, body } = mapPactAuthError(err);

    return NextResponse.json(body, { status });
  }

  const parsedOptions = parseCeremonyOptions(resp.optionsJson);
  if (!parsedOptions.ok) {
    return NextResponse.json(
      { error: 'invalid passkey options' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ceremonyId: resp.ceremonyId,
    options: parsedOptions.options,
  });
};

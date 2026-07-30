import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import {
  MFA_TOKEN_COOKIE,
  OAUTH_RETURN_TO_COOKIE,
  setSessionCookies,
} from '@/src/framework/auth/pact_auth/cookies';
import {
  MFA_STEP_UP_ERROR_CODES,
  mapPactAuthError,
} from '@/src/framework/auth/pact_auth/errors';
import {
  getMfaToken,
  invalidJsonResponse,
  isChallengeGoneMessage,
  isString,
  noMfaChallengeResponse,
  readJsonBody,
} from '@/src/framework/auth/pact_auth/route_helpers';

export const runtime = 'nodejs';

type Body = { ceremonyId?: unknown; assertion?: unknown };

// POST /api/auth/mfa/passkey/finish
// Body: { ceremonyId: string, assertion: object }
//
// Completes the WebAuthn assertion ceremony /api/auth/mfa/passkey/begin
// started, as an alternative to /api/auth/mfa/verify's TOTP/recovery-code
// path (PACT-697). mfa_token comes off the same httpOnly cookie verify
// reads.
//
// On success: writes pact_session, clears pact_mfa_token, returns
// { ok: true, userId } - identical shape to verify's success response.
//
// On failure the mfa_token's fate depends on where pact-auth rejected the
// assertion (see FinishMfaPasskeyAssertion's docblock in
// pact-auth/internal/features/mfa/handler.go): an assertion payload that
// fails to even parse (InvalidArgument, "invalid assertion payload") never
// reaches ConsumeChallenge, so the token survives and the user can retry -
// either the passkey button again or falling back to a TOTP code, exactly
// like this route's happy path leaves the cookie untouched until success.
// Anything that gets past parsing - a challenge that was already dead, or
// an assertion that parses but fails WebAuthn verification - has already
// consumed the token by the time pact-auth answers Unauthenticated,
// mirroring verify's own consume-then-verify posture for a wrong TOTP
// code, so the cookie is always cleared in that branch below.
export const POST = async (req: NextRequest) => {
  const mfaToken = await getMfaToken();
  if (!mfaToken) {
    return noMfaChallengeResponse();
  }

  const body = await readJsonBody<Body>(req);
  if (body === null) {
    return invalidJsonResponse();
  }
  if (!isString(body.ceremonyId) || !body.ceremonyId) {
    return NextResponse.json(
      {
        error: 'ceremonyId is required',
        code: MFA_STEP_UP_ERROR_CODES.invalidCode,
      },
      { status: 400 }
    );
  }
  if (!body.assertion || typeof body.assertion !== 'object') {
    return NextResponse.json(
      {
        error: 'assertion is required',
        code: MFA_STEP_UP_ERROR_CODES.invalidCode,
      },
      { status: 400 }
    );
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['finishMfaPasskey']>
  >;
  try {
    resp = await getPactAuthClient().finishMfaPasskey({
      mfaToken,
      ceremonyId: body.ceremonyId,
      assertionJson: new TextEncoder().encode(JSON.stringify(body.assertion)),
    });
  } catch (err) {
    return finishMfaPasskeyErrorResponse(err);
  }

  const res = NextResponse.json({ ok: true, userId: resp.userId });
  setSessionCookies(res, resp);
  // The challenge is one-shot and now consumed server-side.
  res.cookies.delete(MFA_TOKEN_COOKIE);
  // The client already read this into `returnTo` when it rendered
  // /login/mfa; clear it so a stale tab can't linger with it past the
  // challenge's own lifetime.
  res.cookies.delete(OAUTH_RETURN_TO_COOKIE);

  return res;
};

const finishMfaPasskeyErrorResponse = (err: unknown): NextResponse => {
  if (err instanceof ConnectError && err.code === Code.Unauthenticated) {
    const challengeGone = isChallengeGoneMessage(err.rawMessage);
    const res = NextResponse.json(
      {
        error: challengeGone
          ? 'Your sign-in attempt expired. Enter your password again.'
          : 'Your passkey could not be verified. Enter your password again.',
        code: challengeGone
          ? MFA_STEP_UP_ERROR_CODES.challengeExpired
          : MFA_STEP_UP_ERROR_CODES.passkeyFailed,
      },
      { status: 401 }
    );
    res.cookies.delete(MFA_TOKEN_COOKIE);

    return res;
  }

  const { status, body } = mapPactAuthError(err);

  return NextResponse.json(body, { status });
};

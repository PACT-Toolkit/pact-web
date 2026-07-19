import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import {
  MFA_TOKEN_COOKIE,
  MFA_TOKEN_TTL_SECONDS,
  SESSION_COOKIE,
  sessionCookieOptions,
  shortLivedCookieOptions,
} from '@/src/framework/auth/pact_auth/cookies';
import {
  AUTH_ERROR_CODES,
  mapPactAuthError,
} from '@/src/framework/auth/pact_auth/errors';
import {
  MOCK_MFA_RESET_TOKEN,
  mockMfaRequiredResponse,
} from '@/src/framework/auth/pact_auth/mock';
import {
  invalidJsonResponse,
  isString,
  readJsonBody,
} from '@/src/framework/auth/pact_auth/route_helpers';
import { isMock } from '@/src/framework/helpers/environment';

export const runtime = 'nodejs';

type Body = { token?: unknown; password?: unknown };

// Confirms a password reset using the token from the email link. On success
// pact-auth issues a fresh session, revokes any prior sessions for the user,
// and we set the cookie. The form lives at /reset-password (Client
// Component); this route exists to bridge it to pact-auth and own the
// cookie write.
//
// MFA step-up gate: if the resetting user has a verified MFA factor,
// pact-auth withholds the session (session_token/refresh_token are empty)
// and instead hands us a short-lived mfa_token, identical in shape to the
// login MFA branch below. We stash it in the same httpOnly cookie the
// /login/mfa step-up form reads, so a user who resets their password still
// has to clear the second factor before getting a session.
export const POST = async (req: NextRequest) => {
  const body = await readJsonBody<Body>(req);
  if (body === null) {
    return invalidJsonResponse();
  }

  const { token, password } = body;
  if (!isString(token) || !isString(password) || !token || !password) {
    return NextResponse.json(
      { error: 'token and password required' },
      { status: 400 }
    );
  }

  // Dev:mock has no gRPC layer to fake pact-auth against - see
  // src/framework/auth/pact_auth/mock.ts. A well-known sentinel token lets a
  // developer demo the MFA step-up branch without pact-auth running; any
  // other token still goes through the real call below, unchanged.
  if (isMock() && token === MOCK_MFA_RESET_TOKEN) {
    return mockMfaRequiredResponse();
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['confirmPasswordReset']>
  >;
  try {
    resp = await getPactAuthClient().confirmPasswordReset({
      token,
      newPassword: password,
    });
  } catch (err) {
    // Unauthenticated on reset means "the token doesn't match a live
    // reset request" — surfaced with a domain-specific code so the form
    // can offer a "request a new link" CTA. Other codes go through the
    // shared mapper.
    if (err instanceof ConnectError && err.code === Code.Unauthenticated) {
      return NextResponse.json(
        {
          code: AUTH_ERROR_CODES.unauthorized,
          error:
            'This reset link is invalid or has expired. Request a new one to continue.',
        },
        { status: 401 }
      );
    }
    const { status, body } = mapPactAuthError(err);

    return NextResponse.json(body, { status });
  }

  if (resp.mfaRequired) {
    if (!resp.mfaToken) {
      // Defensive: pact-auth never returns mfa_required without a token,
      // but if it ever did we'd otherwise quietly issue an unusable cookie.
      return NextResponse.json(
        { error: 'sign-in service returned an unusable response' },
        { status: 502 }
      );
    }
    const res = NextResponse.json({
      ok: true,
      mfaRequired: true,
      userId: resp.userId,
    });
    res.cookies.set({
      name: MFA_TOKEN_COOKIE,
      value: resp.mfaToken,
      ...shortLivedCookieOptions(MFA_TOKEN_TTL_SECONDS),
    });

    return res;
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

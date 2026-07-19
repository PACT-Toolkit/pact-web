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
  MOCK_MFA_LOGIN_EMAIL,
  mockMfaRequiredResponse,
} from '@/src/framework/auth/pact_auth/mock';
import {
  invalidJsonResponse,
  isString,
  readJsonBody,
} from '@/src/framework/auth/pact_auth/route_helpers';
import { isMock } from '@/src/framework/helpers/environment';

export const runtime = 'nodejs';

type LoginBody = { email?: unknown; password?: unknown };

export const POST = async (req: NextRequest) => {
  const body = await readJsonBody<LoginBody>(req);
  if (body === null) {
    return invalidJsonResponse();
  }

  const { email, password } = body;
  if (!isString(email) || !isString(password) || !email || !password) {
    return NextResponse.json(
      { error: 'email and password required' },
      { status: 400 }
    );
  }

  // Dev:mock has no gRPC layer to fake pact-auth against - see
  // src/framework/auth/pact_auth/mock.ts. A well-known sentinel email lets a
  // developer demo the MFA step-up branch without pact-auth running; any
  // other email still goes through the real call below, unchanged.
  if (isMock() && email === MOCK_MFA_LOGIN_EMAIL) {
    return mockMfaRequiredResponse();
  }

  let resp: Awaited<ReturnType<ReturnType<typeof getPactAuthClient>['login']>>;
  try {
    resp = await getPactAuthClient().login({ email, password });
  } catch (err) {
    return loginErrorResponse(err);
  }

  // MFA branch: pact-auth has revoked the preliminary session and handed
  // us a short-lived mfa_token. We stash it in an httpOnly cookie so the
  // step-up page (and only that page) can present it back via
  // /api/auth/mfa/verify. Keeping it out of the response body and out of
  // JS-readable storage means a hostile script on a different tab can't
  // hijack the half-finished login.
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

// Login has two domain-specific outcomes that the generic mapper would
// otherwise blur together with the rest of the gRPC codes:
//   Unauthenticated → "invalid credentials" (we deliberately don't
//     leak which factor failed; pact-auth is constant-time on the
//     not-found path).
//   FailedPrecondition → "email not verified" — surfaced as a distinct
//     code so the form can render a "resend verification" affordance
//     instead of the generic error treatment.
// Everything else delegates to mapPactAuthError for the standard shape.
const loginErrorResponse = (err: unknown): NextResponse => {
  if (err instanceof ConnectError) {
    if (err.code === Code.Unauthenticated) {
      return NextResponse.json(
        {
          code: AUTH_ERROR_CODES.unauthorized,
          error: 'Invalid email or password.',
        },
        { status: 401 }
      );
    }
    if (err.code === Code.FailedPrecondition) {
      return NextResponse.json(
        {
          code: 'email_not_verified',
          error:
            'Please verify your email before signing in. Check your inbox for the verification link.',
        },
        { status: 403 }
      );
    }
  }
  const { status, body } = mapPactAuthError(err);

  return NextResponse.json(body, { status });
};

import { Code, ConnectError } from '@connectrpc/connect';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';
const MFA_TOKEN_COOKIE = 'pact_mfa_token';
// Set only on the OAuth-callback MFA branch (app/v1/auth/callback/[provider]).
// Absent for password-login MFA; deleting an absent cookie is a no-op.
const OAUTH_RETURN_TO_COOKIE = 'pact_oauth_return_to';

type Body = { code?: unknown; isRecovery?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// POST /api/auth/mfa/verify
// Body: { code: string, isRecovery?: boolean }
//
// Completes the password+TOTP login flow. Picks the mfa_token out of the
// httpOnly cookie set by /api/auth/login on the MFA-required branch, so
// the client never sees nor relays the challenge token directly.
//
// On success: writes the real pact_session cookie, clears pact_mfa_token,
// and returns { ok: true, userId }. On failure: deletes pact_mfa_token
// (the challenge is single-use; pact-auth marks it consumed even on a
// bad code, so we can't keep it around). The form should redirect back
// to /login with the appropriate error code.
export const POST = async (req: NextRequest) => {
  const jar = await cookies();
  const mfaToken = jar.get(MFA_TOKEN_COOKIE)?.value;
  if (!mfaToken) {
    return NextResponse.json(
      {
        error: 'No sign-in in progress. Start again from the login page.',
        code: 'no_challenge',
      },
      { status: 401 }
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (!isString(body.code) || !body.code) {
    return NextResponse.json(
      { error: 'code is required', code: 'invalid_code' },
      { status: 400 }
    );
  }
  const isRecovery = body.isRecovery === true;

  // Light client-side format check. pact-auth validates server-side, but
  // shaving an obvious typo here avoids burning a single-use challenge
  // token on a code that can never be valid.
  const normalized = body.code.replace(/\s+/g, '').trim();
  if (!isRecovery && !/^\d{6}$/.test(normalized)) {
    return NextResponse.json(
      { error: 'Authenticator code must be 6 digits.', code: 'invalid_code' },
      { status: 400 }
    );
  }
  if (isRecovery && normalized.length < 6) {
    return NextResponse.json(
      { error: 'Recovery code looks too short.', code: 'invalid_code' },
      { status: 400 }
    );
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['verifyMfa']>
  >;
  try {
    resp = await getPactAuthClient().verifyMfa({
      mfaToken,
      code: normalized,
      isRecovery,
    });
  } catch (err) {
    return verifyErrorResponse(err);
  }

  const expiresAt = new Date(Number(resp.expiresAtUnix) * 1000);
  const res = NextResponse.json({ ok: true, userId: resp.userId });
  res.cookies.set({
    name: SESSION_COOKIE,
    value: resp.sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
  // The challenge is one-shot and now consumed server-side.
  res.cookies.delete(MFA_TOKEN_COOKIE);
  // The client already read this into `returnTo` when it rendered
  // /login/mfa; clear it so a stale tab can't linger with it past the
  // challenge's own lifetime.
  res.cookies.delete(OAUTH_RETURN_TO_COOKIE);

  return res;
};

// pact-auth packs two distinct failures under Code.Unauthenticated:
// "invalid MFA code" (user mistyped — let them try again) and
// "MFA challenge invalid or expired" (token revoked / TTL hit — they
// need to re-enter their password). We split them by raw message so
// the form can offer the right next step.
const verifyErrorResponse = async (err: unknown): Promise<NextResponse> => {
  if (err instanceof ConnectError) {
    const raw = err.rawMessage.toLowerCase();
    switch (err.code) {
      case Code.Unauthenticated: {
        const challengeGone =
          raw.includes('challenge') || raw.includes('expired');
        if (challengeGone) {
          const res = NextResponse.json(
            {
              error: 'Your sign-in attempt expired. Enter your password again.',
              code: 'challenge_expired',
            },
            { status: 401 }
          );
          res.cookies.delete(MFA_TOKEN_COOKIE);

          return res;
        }

        // Wrong code: keep the cookie in place so the user can retry
        // without re-entering their password.
        return NextResponse.json(
          {
            error: 'That code didn’t match. Try again.',
            code: 'invalid_code',
          },
          { status: 401 }
        );
      }
      case Code.InvalidArgument:
        return NextResponse.json(
          {
            error: err.rawMessage || 'That code didn’t look right.',
            code: 'invalid_code',
          },
          { status: 400 }
        );
      case Code.ResourceExhausted:
        return NextResponse.json(
          {
            error: 'Too many attempts. Please wait a moment and try again.',
            code: 'rate_limited',
          },
          { status: 429 }
        );
      default:
        break;
    }
  }

  return NextResponse.json(
    { error: 'Could not verify the code. Please try again.' },
    { status: 500 }
  );
};

import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import {
  AUTH_ERROR_CODES,
  mapPactAuthError,
} from '@/src/framework/auth/pact_auth/errors';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

type Body = { token?: unknown; password?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// Confirms a password reset using the token from the email link. On success
// pact-auth issues a fresh session, revokes any prior sessions for the user,
// and we set the cookie. The form lives at /reset-password (Client
// Component); this route exists to bridge it to pact-auth and own the
// cookie write.
export const POST = async (req: NextRequest) => {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { token, password } = body;
  if (!isString(token) || !isString(password) || !token || !password) {
    return NextResponse.json(
      { error: 'token and password required' },
      { status: 400 }
    );
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

  return res;
};

import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';

type LoginBody = { email?: unknown; password?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

export const POST = async (req: NextRequest) => {
  let body: LoginBody;
  try {
    body = (await req.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { email, password } = body;
  if (!isString(email) || !isString(password) || !email || !password) {
    return NextResponse.json(
      { error: 'email and password required' },
      { status: 400 }
    );
  }

  let resp: Awaited<ReturnType<ReturnType<typeof getPactAuthClient>['login']>>;
  try {
    resp = await getPactAuthClient().login({ email, password });
  } catch (err) {
    return loginErrorResponse(err);
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

const loginErrorResponse = (err: unknown): NextResponse => {
  if (!(err instanceof ConnectError)) {
    return NextResponse.json({ error: 'login failed' }, { status: 500 });
  }
  switch (err.code) {
    case Code.Unauthenticated:
      return NextResponse.json(
        { error: 'invalid credentials' },
        { status: 401 }
      );
    case Code.FailedPrecondition:
      return NextResponse.json(
        { error: 'email not verified' },
        { status: 403 }
      );
    case Code.InvalidArgument:
      return NextResponse.json({ error: err.rawMessage }, { status: 400 });
    case Code.ResourceExhausted:
      return NextResponse.json(
        { error: 'too many attempts, try again later' },
        { status: 429 }
      );
    default:
      return NextResponse.json({ error: 'login failed' }, { status: 500 });
  }
};

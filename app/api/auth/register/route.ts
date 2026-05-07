import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  returnTo?: unknown;
};

const isString = (v: unknown): v is string => typeof v === 'string';

// pact-auth's Register is anti-enumeration: it returns an empty success
// response whether the email is fresh, already taken, or already verified.
// We mirror that contract — the UI shows the same "check your email" screen
// regardless. Validation errors (bad email format, weak password) DO surface
// because they leak nothing about account state.
export const POST = async (req: NextRequest) => {
  let body: RegisterBody;
  try {
    body = (await req.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { email, password, returnTo } = body;
  if (!isString(email) || !isString(password) || !email || !password) {
    return NextResponse.json(
      { error: 'email and password required' },
      { status: 400 }
    );
  }

  const defaultReturnTo =
    process.env.PACT_AUTH_DEFAULT_RETURN_TO ??
    'http://localhost:3000/dashboard';

  try {
    await getPactAuthClient().register({
      email,
      password,
      returnTo: isString(returnTo) && returnTo ? returnTo : defaultReturnTo,
    });
  } catch (err) {
    if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
      return NextResponse.json({ error: err.rawMessage }, { status: 400 });
    }
    if (err instanceof ConnectError && err.code === Code.ResourceExhausted) {
      return NextResponse.json(
        { error: 'too many attempts, try again later' },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: 'register failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

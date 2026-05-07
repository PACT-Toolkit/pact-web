import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

type Body = { email?: unknown; returnTo?: unknown };

const isString = (v: unknown): v is string => typeof v === 'string';

// Anti-enumeration mirror of pact-auth's RequestPasswordReset: returns 200
// regardless of whether the email maps to an account. Validation errors
// (malformed email) DO surface — they leak nothing about account state.
export const POST = async (req: NextRequest) => {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }

  const { email, returnTo } = body;
  if (!isString(email) || !email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  // The reset link in the email lands on the UI page; that page POSTs to
  // /api/auth/reset-password with the new password. Whatever return_to we
  // pass here is what pact-auth echoes back to the UI — we just want a
  // post-success destination.
  const defaultReturnTo =
    process.env.PACT_AUTH_DEFAULT_RETURN_TO ??
    'http://localhost:3000/dashboard';

  try {
    await getPactAuthClient().requestPasswordReset({
      email,
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

    return NextResponse.json({ error: 'request failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
};

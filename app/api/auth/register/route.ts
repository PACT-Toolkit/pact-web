import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import { defaultReturnTo } from '@/src/framework/auth/pact_auth/return_to';

export const runtime = 'nodejs';

type RegisterBody = {
  email?: unknown;
  password?: unknown;
  returnTo?: unknown;
  // The form field is `display_name` to match the proto wire name; we also
  // accept `displayName` for code that comes through the JS client.
  display_name?: unknown;
  displayName?: unknown;
};

const isString = (v: unknown): v is string => typeof v === 'string';

const pickDisplayName = (body: RegisterBody): string => {
  if (isString(body.display_name) && body.display_name)
    return body.display_name;
  if (isString(body.displayName) && body.displayName) return body.displayName;

  return '';
};

// pact-auth's Register surfaces `AlreadyExists` when the email is on
// file (whether the existing account has a password or only an OAuth
// identity). We forward that as HTTP 409 with a stable
// `code: 'email_already_registered'` so the form can render a
// dedicated inline error with links to sign-in and forgot-password,
// instead of the generic server-error path. The product team chose
// this UX over the previous "always 200, silently email a reset link"
// flow; see pact-auth's account package doc for the rationale.
//
// Other failure modes still pass through:
//   InvalidArgument → 400 (bad email, weak password, return_to denial)
//   ResourceExhausted → 429 (per-IP rate limit)
//   anything else → 500 generic
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

  const displayName = pickDisplayName(body);
  if (!displayName) {
    return NextResponse.json(
      { error: 'display name is required' },
      { status: 400 }
    );
  }

  try {
    await getPactAuthClient().register({
      email,
      password,
      displayName,
      returnTo:
        isString(returnTo) && returnTo ? returnTo : defaultReturnTo(req),
    });
  } catch (err) {
    if (err instanceof ConnectError && err.code === Code.AlreadyExists) {
      return NextResponse.json(
        {
          code: 'email_already_registered',
          error: 'This email is already registered.',
        },
        { status: 409 }
      );
    }
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

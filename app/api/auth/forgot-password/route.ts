import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import { mapPactAuthError } from '@/src/framework/auth/pact_auth/errors';
import { defaultReturnTo } from '@/src/framework/auth/pact_auth/return_to';
import {
  invalidJsonResponse,
  isString,
  readJsonBody,
} from '@/src/framework/auth/pact_auth/route_helpers';

export const runtime = 'nodejs';

type Body = { email?: unknown; returnTo?: unknown };

// Anti-enumeration mirror of pact-auth's RequestPasswordReset: returns 200
// regardless of whether the email maps to an account. Validation errors
// (malformed email) DO surface — they leak nothing about account state.
export const POST = async (req: NextRequest) => {
  const body = await readJsonBody<Body>(req);
  if (body === null) {
    return invalidJsonResponse();
  }

  const { email, returnTo } = body;
  if (!isString(email) || !email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  // The reset link in the email lands on the UI page; that page POSTs to
  // /api/auth/reset-password with the new password. Whatever return_to we
  // pass here is what pact-auth echoes back to the UI — we just want a
  // post-success destination.
  try {
    await getPactAuthClient().requestPasswordReset({
      email,
      returnTo:
        isString(returnTo) && returnTo ? returnTo : defaultReturnTo(req),
    });
  } catch (err) {
    const { status, body } = mapPactAuthError(err);

    return NextResponse.json(body, { status });
  }

  return NextResponse.json({ ok: true });
};

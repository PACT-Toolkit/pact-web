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

// Anti-enumeration mirror of pact-auth's ResendVerification: returns 200
// regardless of whether the email maps to an account, or whether that
// account is already verified. The only failure surfaces are validation
// (bad email) and rate-limit (per-IP token bucket on the auth side).
//
// The form on /register's "Check your email" screen calls this with the
// same email the user just registered with; returnTo is rebased from the
// inbound origin so verify links land back on this app.
export const POST = async (req: NextRequest) => {
  const body = await readJsonBody<Body>(req);
  if (body === null) {
    return invalidJsonResponse();
  }

  const { email, returnTo } = body;
  if (!isString(email) || !email) {
    return NextResponse.json({ error: 'email required' }, { status: 400 });
  }

  try {
    await getPactAuthClient().resendVerification({
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

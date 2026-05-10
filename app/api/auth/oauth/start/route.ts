import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import { defaultReturnTo } from '@/src/framework/auth/pact_auth/return_to';

export const runtime = 'nodejs';

const STATE_COOKIE = 'pact_oauth_state';
const STATE_TTL_SECONDS = 600;

const ALLOWED_PROVIDERS = new Set(['github', 'google', 'meta']);

// GET /api/auth/oauth/start?provider=github&return_to=…
//
// Calls pact-auth.StartLogin to mint the authorize URL + signed state
// envelope. The signed state goes into an httpOnly cookie that pact-auth
// will read back when the provider redirects to /v1/auth/callback/{provider}.
//
// We use GET (not POST) so the buttons can be plain <a href="…"> — that's
// the OAuth-button convention and avoids a redundant client-side fetch.
// The "side effect" of setting the cookie is integral to the security
// envelope, not a hidden mutation.
export const GET = async (req: NextRequest) => {
  const provider = req.nextUrl.searchParams.get('provider');
  if (!provider || !ALLOWED_PROVIDERS.has(provider)) {
    return NextResponse.json({ error: 'unknown provider' }, { status: 400 });
  }

  const returnToParam = req.nextUrl.searchParams.get('return_to');
  const returnTo = returnToParam ?? defaultReturnTo(req);

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['startLogin']>
  >;
  try {
    resp = await getPactAuthClient().startLogin({ provider, returnTo });
  } catch (err) {
    if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
      return NextResponse.json({ error: err.rawMessage }, { status: 400 });
    }

    return NextResponse.json({ error: 'oauth start failed' }, { status: 500 });
  }

  const res = NextResponse.redirect(resp.authorizationUrl);
  res.cookies.set({
    name: STATE_COOKIE,
    value: resp.state,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_TTL_SECONDS,
  });

  return res;
};

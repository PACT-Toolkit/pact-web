import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';
const STATE_COOKIE = 'pact_oauth_state';
const FALLBACK_RETURN_TO = '/dashboard';

const ALLOWED_PROVIDERS = new Set(['github', 'google', 'meta']);

// GET /v1/auth/callback/{provider}?code=…&state=…
//
// This path shape is fixed by pact-auth — internal/oauth/providers.go
// builds the OAuth app's RedirectURL as `${OAUTH_REDIRECT_BASE_URL}
// /v1/auth/callback/{provider}`, and the URL must match what's registered
// with the provider. If we ever move pact-gateway in front of pact-web
// for OAuth, this handler relocates to the gateway and pact-web is out of
// the OAuth path entirely.
export const GET = async (
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) => {
  const { provider } = await params;
  if (!ALLOWED_PROVIDERS.has(provider)) {
    return failed(req, 'unknown_provider');
  }

  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const providerError = req.nextUrl.searchParams.get('error');

  // Provider-side rejection ("user denied", "access_denied") — the user
  // canceled the consent screen. Send them home with a friendly reason.
  if (providerError) {
    return failed(req, providerError);
  }
  if (!code || !state) {
    return failed(req, 'missing_code_or_state');
  }

  const signedState = req.cookies.get(STATE_COOKIE)?.value;
  if (!signedState) {
    return failed(req, 'missing_state_cookie');
  }

  let resp: Awaited<
    ReturnType<ReturnType<typeof getPactAuthClient>['handleCallback']>
  >;
  try {
    resp = await getPactAuthClient().handleCallback({
      provider,
      code,
      state,
      signedState,
    });
  } catch (err) {
    if (err instanceof ConnectError) {
      switch (err.code) {
        case Code.Unauthenticated:
          return failed(req, 'state_or_code_invalid');
        case Code.AlreadyExists:
          // pact-auth refuses to silently link an OAuth identity to an
          // existing account that already has a different OAuth identity
          // for the same email. The user has to sign in via the original
          // provider, then add this one from settings (once that exists).
          return failed(req, 'email_already_linked');
        default:
          return failed(req, 'callback_failed');
      }
    }

    return failed(req, 'callback_failed');
  }

  // pact-auth echoes back the same return_to it canonicalized at StartLogin
  // and validated against the allowlist. Treat as opaque-but-trusted.
  const returnTo = resp.returnTo || FALLBACK_RETURN_TO;
  const target = (() => {
    try {
      return new URL(returnTo);
    } catch {
      return new URL(returnTo, req.url);
    }
  })();

  const expiresAt = new Date(Number(resp.expiresAtUnix) * 1000);
  const res = NextResponse.redirect(target);
  res.cookies.set({
    name: SESSION_COOKIE,
    value: resp.sessionToken,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
  // Clear the one-shot state cookie regardless of how we got here.
  res.cookies.set({
    name: STATE_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return res;
};

const failed = (req: NextRequest, reason: string) => {
  const url = new URL('/login', req.url);
  url.searchParams.set('oauth_error', reason);
  const res = NextResponse.redirect(url);
  // Burn the state cookie too — it's one-shot and we shouldn't leave it
  // sitting on the box if the dance failed.
  res.cookies.set({
    name: STATE_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });

  return res;
};

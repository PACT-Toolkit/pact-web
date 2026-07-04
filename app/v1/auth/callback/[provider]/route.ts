import { Code, ConnectError } from '@connectrpc/connect';
import { type NextRequest, NextResponse } from 'next/server';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import {
  MFA_TOKEN_COOKIE,
  MFA_TOKEN_TTL_SECONDS,
  shortLivedCookieOptions,
} from '@/src/framework/auth/pact_auth/cookies';
import { rebaseReturnTo } from '@/src/framework/auth/pact_auth/return_to';
import { isMock } from '@/src/framework/helpers/environment';

export const runtime = 'nodejs';

const SESSION_COOKIE = 'pact_session';
const STATE_COOKIE = 'pact_oauth_state';
// Carries the rebased return_to target across the /login/mfa step-up so
// the user lands back on their original deep link (not just /dashboard)
// once they clear the second factor. See auth.proto's HandleCallbackResponse
// comment: "return_to is still populated so the caller can resume the
// post-login redirect once the second factor is verified."
const OAUTH_RETURN_TO_COOKIE = 'pact_oauth_return_to';
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

  if (isMock()) {
    // Complete the dance without calling pact-auth. Set a synthetic
    // session cookie — validateSessionFromCookies() short-circuits in
    // mock mode so the value here is purely cosmetic — and redirect
    // to the original return_to (the start handler put it on the URL).
    const returnTo =
      req.nextUrl.searchParams.get('return_to') || FALLBACK_RETURN_TO;
    const target = rebaseReturnTo(req, returnTo);
    const res = NextResponse.redirect(target);
    res.cookies.set({
      name: SESSION_COOKIE,
      value: 'mock-session-token',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
    res.cookies.set({
      name: STATE_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 0,
    });

    return res;
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
  // and validated against the allowlist. Rebase the host onto the inbound
  // origin so the redirect always lands on a URL the user's current device
  // can reach (preserves the path so /settings/billing-style deep links
  // still work).
  const returnTo = resp.returnTo || FALLBACK_RETURN_TO;
  const target = rebaseReturnTo(req, returnTo);

  // MFA branch: pact-auth has not minted a session — session_token and
  // refresh_token are empty — and instead handed us a short-lived
  // mfa_token. Route through the same /login/mfa step-up the password
  // flow uses, stashing the token in the same httpOnly cookie so the
  // step-up form (and only that form) can present it back via
  // /api/auth/mfa/verify. No pact_session cookie is set on this branch.
  if (resp.mfaRequired) {
    if (!resp.mfaToken) {
      // Defensive: pact-auth never returns mfa_required without a token,
      // but if it ever did we'd otherwise strand the user on a step-up
      // page it has no way to complete.
      return failed(req, 'mfa_token_missing');
    }

    const res = NextResponse.redirect(new URL('/login/mfa', req.url));
    res.cookies.set({
      name: MFA_TOKEN_COOKIE,
      value: resp.mfaToken,
      ...shortLivedCookieOptions(MFA_TOKEN_TTL_SECONDS),
    });
    // Carry the rebased return_to so the step-up form can send the user
    // back to their original deep link once they clear the second factor,
    // instead of always landing on /dashboard.
    res.cookies.set({
      name: OAUTH_RETURN_TO_COOKIE,
      value: target.toString(),
      ...shortLivedCookieOptions(MFA_TOKEN_TTL_SECONDS),
    });
    burnStateCookie(res);

    return res;
  }

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
  burnStateCookie(res);

  return res;
};

const failed = (req: NextRequest, reason: string) => {
  const url = new URL('/login', req.url);
  url.searchParams.set('oauth_error', reason);
  const res = NextResponse.redirect(url);
  // Burn the state cookie too — it's one-shot and we shouldn't leave it
  // sitting on the box if the dance failed.
  burnStateCookie(res);

  return res;
};

// The state cookie is one-shot: burn it on every exit path (success,
// MFA step-up, or failure) so a replayed callback URL can't reuse it.
const burnStateCookie = (res: NextResponse) => {
  res.cookies.set({
    name: STATE_COOKIE,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
};

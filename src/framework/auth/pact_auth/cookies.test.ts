import { NextResponse } from 'next/server';
import { describe, expect, it } from 'vitest';

import {
  clearSessionCookies,
  REFRESH_TOKEN_COOKIE,
  SESSION_COOKIE,
  setSessionCookies,
} from './cookies';

// setSessionCookies/clearSessionCookies are the single place every
// session-issuing route (login, MFA verify, MFA passkey finish, passkey
// login, OAuth callback, password-reset confirm, email verify) and the
// logout route funnel through (PACT-705) - covered directly here rather
// than duplicating the same cookie-shape assertions across every route's
// own test file.
describe('setSessionCookies', () => {
  it('sets both the session and refresh cookies when a refresh token is present', () => {
    const res = NextResponse.json({ ok: true });
    const expiresAtUnix = Math.floor(Date.now() / 1000) + 3600;

    setSessionCookies(res, {
      sessionToken: 'session-token',
      refreshToken: 'refresh-token',
      expiresAtUnix,
    });

    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe('session-token');
    expect(res.cookies.get(REFRESH_TOKEN_COOKIE)?.value).toBe('refresh-token');
  });

  it('does not set a refresh cookie when the refresh token is empty', () => {
    const res = NextResponse.json({ ok: true });

    setSessionCookies(res, {
      sessionToken: 'session-token',
      refreshToken: '',
      expiresAtUnix: Math.floor(Date.now() / 1000) + 3600,
    });

    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe('session-token');
    expect(res.cookies.get(REFRESH_TOKEN_COOKIE)).toBeUndefined();
  });
});

describe('clearSessionCookies', () => {
  it('clears both the session and refresh cookies', () => {
    const res = NextResponse.json({ ok: true });

    clearSessionCookies(res);

    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe('');
    expect(res.cookies.get(REFRESH_TOKEN_COOKIE)?.value).toBe('');
  });
});

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { redeemRefreshToken } from '@/src/lib/proxy/refresh_session';

import { proxy } from './proxy';

vi.mock('@/src/lib/proxy/refresh_session', () => ({
  redeemRefreshToken: vi.fn(),
}));

const redeemRefreshTokenMock = vi.mocked(redeemRefreshToken);

const makeRequest = (cookieHeader?: string, path = '/dashboard') =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });

// PACT-726: proxy.ts's silent-renewal branch. See the file's own docblock
// for why this can't share proxy_to_gateway.ts's rotation (structurally
// disjoint on session-cookie presence) and why redeemRefreshToken itself
// (not this test) owns the single-flight guarantee - these tests mock it
// out entirely so proxy.ts's own branching is exercised in isolation.
describe('proxy', () => {
  beforeEach(() => {
    redeemRefreshTokenMock.mockReset();
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'disabled');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('passes through when a session cookie is present, without attempting renewal', async () => {
    const res = await proxy(makeRequest('pact_session=valid-session'));

    expect(res.status).toBe(200);
    expect(redeemRefreshTokenMock).not.toHaveBeenCalled();
  });

  it('passes through public paths with no cookies at all', async () => {
    const res = await proxy(makeRequest(undefined, '/login'));

    expect(res.status).toBe(200);
    expect(redeemRefreshTokenMock).not.toHaveBeenCalled();
  });

  it('redirects to /login with no session and no refresh cookie', async () => {
    const res = await proxy(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
    expect(redeemRefreshTokenMock).not.toHaveBeenCalled();
  });

  it('silently renews and sets a fresh cookie pair when the refresh token redeems successfully', async () => {
    redeemRefreshTokenMock.mockResolvedValue({
      sessionToken: 'new-session',
      refreshToken: 'new-refresh',
      expiresAtUnix: 1_700_000_000,
    });

    const res = await proxy(makeRequest('pact_refresh_token=old-refresh'));

    expect(redeemRefreshTokenMock).toHaveBeenCalledWith(
      'old-refresh',
      undefined
    );
    expect(res.status).toBe(200);
    expect(res.cookies.get('pact_session')?.value).toBe('new-session');
    expect(res.cookies.get('pact_refresh_token')?.value).toBe('new-refresh');
  });

  it('forwards the resolved client IP to redeemRefreshToken', async () => {
    redeemRefreshTokenMock.mockResolvedValue({
      sessionToken: 's',
      refreshToken: 'r',
      expiresAtUnix: 1,
    });

    const request = new NextRequest('http://localhost:3000/dashboard', {
      headers: {
        cookie: 'pact_refresh_token=old-refresh',
        'x-real-ip': '203.0.113.5',
      },
    });
    await proxy(request);

    expect(redeemRefreshTokenMock).toHaveBeenCalledWith(
      'old-refresh',
      '203.0.113.5'
    );
  });

  it('clears both cookies and redirects to /login when redemption fails (invalid, expired, or reused token)', async () => {
    redeemRefreshTokenMock.mockResolvedValue(null);

    const res = await proxy(makeRequest('pact_refresh_token=stale-refresh'));

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login');
    expect(res.cookies.get('pact_session')?.value).toBe('');
    expect(res.cookies.get('pact_refresh_token')?.value).toBe('');
  });

  it('short-circuits entirely in mock mode, without touching cookies', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');

    const res = await proxy(makeRequest());

    expect(res.status).toBe(200);
    expect(redeemRefreshTokenMock).not.toHaveBeenCalled();
  });
});

import { Code, ConnectError } from '@connectrpc/connect';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import { MOCK_MFA_CHALLENGE_TOKEN } from '@/src/framework/auth/pact_auth/mock';

import { POST } from './route';

vi.mock('@/src/framework/auth/pact_auth/client', () => ({
  getPactAuthClient: vi.fn(),
}));

// The route reads the challenge token via next/headers' cookies() (request
// context), not req.cookies, so route handler tests need to fake that
// module rather than set a cookie on the NextRequest directly.
let cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: () =>
    Promise.resolve({
      get: (name: string) => {
        const value = cookieJar.get(name);

        return value === undefined ? undefined : { value };
      },
    }),
}));

// The route only ever calls `.verifyMfa(...)` on the client, so the fake
// only needs to implement that one method.
type VerifyMfaResult = Awaited<
  ReturnType<ReturnType<typeof getPactAuthClient>['verifyMfa']>
>;
const fakeAuthClient = (verifyMfa: () => Promise<VerifyMfaResult>) =>
  ({ verifyMfa }) as unknown as ReturnType<typeof getPactAuthClient>;

const SESSION_COOKIE = 'pact_session';
const MFA_TOKEN_COOKIE = 'pact_mfa_token';

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/mfa/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const mockGetPactAuthClient = vi.mocked(getPactAuthClient);

describe('POST /api/auth/mfa/verify', () => {
  beforeEach(() => {
    mockGetPactAuthClient.mockReset();
    cookieJar = new Map();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when there is no mfa_token cookie', async () => {
    const res = await POST(makeRequest({ code: '123456' }));

    expect(res.status).toBe(401);
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('sets the session cookie and clears the mfa cookie on a correct code', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: 'real-session-token',
          refreshToken: 'refresh-token',
          userId: 'user-1',
          expiresAtUnix: BigInt(Math.floor(Date.now() / 1000) + 3600),
        } as VerifyMfaResult)
      )
    );

    const res = await POST(makeRequest({ code: '123456' }));

    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe('real-session-token');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('');
  });

  it('completes with a synthetic session in mock mode when the cookie holds the mock challenge token, without calling pact-auth', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    cookieJar.set(MFA_TOKEN_COOKIE, MOCK_MFA_CHALLENGE_TOKEN);

    const res = await POST(makeRequest({ code: '123456' }));

    expect(res.status).toBe(200);
    const payload = (await res.json()) as { ok: boolean; userId: string };
    expect(payload.ok).toBe(true);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBeTruthy();
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('');
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('still calls pact-auth in mock mode when the cookie does not hold the mock challenge token', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: 'real-session-token',
          refreshToken: 'refresh-token',
          userId: 'user-1',
          expiresAtUnix: BigInt(Math.floor(Date.now() / 1000) + 3600),
        } as VerifyMfaResult)
      )
    );

    const res = await POST(makeRequest({ code: '123456' }));

    expect(res.status).toBe(200);
    expect(mockGetPactAuthClient).toHaveBeenCalledTimes(1);
  });

  it('returns 401 with a challenge_expired code when the challenge is gone', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.reject(
          new ConnectError(
            'rpc error: code = Unauthenticated desc = challenge expired',
            Code.Unauthenticated
          )
        )
      )
    );

    const res = await POST(makeRequest({ code: '123456' }));

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('challenge_expired');
  });
});

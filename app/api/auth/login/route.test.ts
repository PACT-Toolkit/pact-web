import { Code, ConnectError } from '@connectrpc/connect';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';
import { MOCK_MFA_LOGIN_EMAIL } from '@/src/framework/auth/pact_auth/mock';

import { POST } from './route';

vi.mock('@/src/framework/auth/pact_auth/client', () => ({
  getPactAuthClient: vi.fn(),
}));

// The route only ever calls `.login(...)` on the client, so the fake only
// needs to implement that one method.
type LoginResult = Awaited<
  ReturnType<ReturnType<typeof getPactAuthClient>['login']>
>;
const fakeAuthClient = (login: () => Promise<LoginResult>) =>
  ({ login }) as unknown as ReturnType<typeof getPactAuthClient>;

const SESSION_COOKIE = 'pact_session';
const MFA_TOKEN_COOKIE = 'pact_mfa_token';

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const mockGetPactAuthClient = vi.mocked(getPactAuthClient);

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    mockGetPactAuthClient.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('sets the session cookie and returns ok when MFA is not required', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: 'real-session-token',
          refreshToken: 'refresh-token',
          userId: 'user-1',
          expiresAtUnix: BigInt(Math.floor(Date.now() / 1000) + 3600),
          mfaRequired: false,
          mfaToken: '',
        } as LoginResult)
      )
    );

    const res = await POST(
      makeRequest({ email: 'user@example.com', password: 'correct-password' })
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as { ok: boolean; userId: string };
    expect(payload).toEqual({ ok: true, userId: 'user-1' });
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe('real-session-token');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)).toBeUndefined();
  });

  it('sets the mfa cookie and skips the session cookie when MFA is required', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: '',
          refreshToken: '',
          userId: 'user-1',
          expiresAtUnix: BigInt(0),
          mfaRequired: true,
          mfaToken: 'challenge-token',
        } as LoginResult)
      )
    );

    const res = await POST(
      makeRequest({ email: 'user@example.com', password: 'correct-password' })
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      ok: boolean;
      mfaRequired: boolean;
      userId: string;
    };
    expect(payload).toEqual({ ok: true, mfaRequired: true, userId: 'user-1' });
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('challenge-token');
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it('returns 502 when mfaRequired is true but mfaToken is empty', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: '',
          refreshToken: '',
          userId: 'user-1',
          expiresAtUnix: BigInt(0),
          mfaRequired: true,
          mfaToken: '',
        } as LoginResult)
      )
    );

    const res = await POST(
      makeRequest({ email: 'user@example.com', password: 'correct-password' })
    );

    expect(res.status).toBe(502);
    expect(res.cookies.get(MFA_TOKEN_COOKIE)).toBeUndefined();
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it('returns 400 when email or password is missing', async () => {
    const res = await POST(makeRequest({ email: '', password: '' }));

    expect(res.status).toBe(400);
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('returns a domain-specific 401 on invalid credentials', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.reject(
          new ConnectError(
            'rpc error: code = Unauthenticated desc = bad credentials',
            Code.Unauthenticated
          )
        )
      )
    );

    const res = await POST(
      makeRequest({ email: 'user@example.com', password: 'wrong-password' })
    );

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('unauthorized');
  });

  it('returns a synthetic mfaRequired response without calling pact-auth when in mock mode with the sentinel email', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');

    const res = await POST(
      makeRequest({ email: MOCK_MFA_LOGIN_EMAIL, password: 'anything' })
    );

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      ok: boolean;
      mfaRequired: boolean;
    };
    expect(payload.ok).toBe(true);
    expect(payload.mfaRequired).toBe(true);
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBeTruthy();
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('still calls pact-auth in mock mode when the email is not the mock sentinel', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: 'real-session-token',
          refreshToken: 'refresh-token',
          userId: 'user-1',
          expiresAtUnix: BigInt(Math.floor(Date.now() / 1000) + 3600),
          mfaRequired: false,
          mfaToken: '',
        } as LoginResult)
      )
    );

    const res = await POST(
      makeRequest({ email: 'user@example.com', password: 'correct-password' })
    );

    expect(res.status).toBe(200);
    expect(mockGetPactAuthClient).toHaveBeenCalledTimes(1);
  });
});

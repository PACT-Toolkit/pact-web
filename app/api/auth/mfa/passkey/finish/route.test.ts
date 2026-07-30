import { Code, ConnectError } from '@connectrpc/connect';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

import { POST } from './route';

vi.mock('@/src/framework/auth/pact_auth/client', () => ({
  getPactAuthClient: vi.fn(),
}));

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

type FinishMfaPasskeyResult = Awaited<
  ReturnType<ReturnType<typeof getPactAuthClient>['finishMfaPasskey']>
>;
const fakeAuthClient = (
  finishMfaPasskey: () => Promise<FinishMfaPasskeyResult>
) => ({ finishMfaPasskey }) as unknown as ReturnType<typeof getPactAuthClient>;

const SESSION_COOKIE = 'pact_session';
const REFRESH_TOKEN_COOKIE = 'pact_refresh_token';
const MFA_TOKEN_COOKIE = 'pact_mfa_token';

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/mfa/passkey/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const validBody = { ceremonyId: 'cer-1', assertion: { id: 'cred-1' } };

const mockGetPactAuthClient = vi.mocked(getPactAuthClient);

describe('POST /api/auth/mfa/passkey/finish', () => {
  beforeEach(() => {
    mockGetPactAuthClient.mockReset();
    cookieJar = new Map();
  });

  it('returns 401 with no_challenge when there is no mfa_token cookie', async () => {
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('no_challenge');
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('returns 400 when ceremonyId is missing', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');

    const res = await POST(makeRequest({ assertion: { id: 'cred-1' } }));

    expect(res.status).toBe(400);
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('returns 400 when assertion is missing', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');

    const res = await POST(makeRequest({ ceremonyId: 'cer-1' }));

    expect(res.status).toBe(400);
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('sets the session cookie and clears the mfa cookie on a successful assertion', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: 'real-session-token',
          refreshToken: 'refresh-token',
          userId: 'user-1',
          expiresAtUnix: Math.floor(Date.now() / 1000) + 3600,
          mfaRequired: false,
          mfaToken: '',
          returnTo: '',
        } as FinishMfaPasskeyResult)
      )
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe('real-session-token');
    expect(res.cookies.get(REFRESH_TOKEN_COOKIE)?.value).toBe('refresh-token');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('');
  });

  it('returns 401 with challenge_expired and clears the cookie when the challenge is already dead', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.reject(
          new ConnectError(
            'MFA challenge invalid or expired',
            Code.Unauthenticated
          )
        )
      )
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('challenge_expired');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('');
  });

  it('returns 401 with passkey_failed and clears the cookie when the assertion fails verification', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.reject(
          new ConnectError('passkey verification failed', Code.Unauthenticated)
        )
      )
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('passkey_failed');
    // The mfa_token is already burned server-side by the time this fires
    // (ConsumeChallenge runs before FinishLogin) - the cookie must go too.
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('');
  });

  it('does not clear the mfa cookie when the assertion payload fails to parse (token never consumed)', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.reject(
          new ConnectError('invalid assertion payload', Code.InvalidArgument)
        )
      )
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(400);
    const payload = (await res.json()) as { code: string; error: string };
    expect(payload.code).toBe('validation_error');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)).toBeUndefined();
  });
});

import { Code, ConnectError } from '@connectrpc/connect';
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

import { POST } from './route';

vi.mock('@/src/framework/auth/pact_auth/client', () => ({
  getPactAuthClient: vi.fn(),
}));

// The route only ever calls `.confirmPasswordReset(...)` on the client, so
// the fake only needs to implement that one method.
type ConfirmPasswordResetResult = Awaited<
  ReturnType<ReturnType<typeof getPactAuthClient>['confirmPasswordReset']>
>;
const fakeAuthClient = (
  confirmPasswordReset: () => Promise<ConfirmPasswordResetResult>
) =>
  ({ confirmPasswordReset }) as unknown as ReturnType<typeof getPactAuthClient>;

const SESSION_COOKIE = 'pact_session';
const MFA_TOKEN_COOKIE = 'pact_mfa_token';

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const mockGetPactAuthClient = vi.mocked(getPactAuthClient);

describe('POST /api/auth/reset-password', () => {
  beforeEach(() => {
    mockGetPactAuthClient.mockReset();
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
        } as ConfirmPasswordResetResult)
      )
    );

    const res = await POST(
      makeRequest({ token: 'reset-token', password: 'a-long-new-password' })
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
        } as ConfirmPasswordResetResult)
      )
    );

    const res = await POST(
      makeRequest({ token: 'reset-token', password: 'a-long-new-password' })
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
        } as ConfirmPasswordResetResult)
      )
    );

    const res = await POST(
      makeRequest({ token: 'reset-token', password: 'a-long-new-password' })
    );

    expect(res.status).toBe(502);
    expect(res.cookies.get(MFA_TOKEN_COOKIE)).toBeUndefined();
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
  });

  it('returns 400 when token or password is missing', async () => {
    const res = await POST(makeRequest({ token: '', password: '' }));

    expect(res.status).toBe(400);
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('returns a domain-specific 401 when the reset token is invalid', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.reject(
          new ConnectError(
            'rpc error: code = Unauthenticated desc = bad token',
            Code.Unauthenticated
          )
        )
      )
    );

    const res = await POST(
      makeRequest({ token: 'stale-token', password: 'a-long-new-password' })
    );

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('unauthorized');
  });
});

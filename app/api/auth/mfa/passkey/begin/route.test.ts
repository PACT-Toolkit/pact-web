import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

import { POST } from './route';

vi.mock('@/src/framework/auth/pact_auth/client', () => ({
  getPactAuthClient: vi.fn(),
}));

// The route reads the challenge token via next/headers' cookies() (request
// context) through getMfaToken() - see mfa/verify/route.test.ts for the
// same pattern.
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

type BeginMfaPasskeyResult = Awaited<
  ReturnType<ReturnType<typeof getPactAuthClient>['beginMfaPasskey']>
>;
const fakeAuthClient = (
  beginMfaPasskey: () => Promise<BeginMfaPasskeyResult>
) => ({ beginMfaPasskey }) as unknown as ReturnType<typeof getPactAuthClient>;

const MFA_TOKEN_COOKIE = 'pact_mfa_token';

const mockGetPactAuthClient = vi.mocked(getPactAuthClient);

describe('POST /api/auth/mfa/passkey/begin', () => {
  beforeEach(() => {
    mockGetPactAuthClient.mockReset();
    cookieJar = new Map();
  });

  it('returns 401 with no_challenge when there is no mfa_token cookie', async () => {
    const res = await POST();

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('no_challenge');
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('returns the ceremony id and unwrapped options on success', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          ceremonyId: 'cer-1',
          optionsJson: new TextEncoder().encode(
            JSON.stringify({ publicKey: { challenge: 'abc' } })
          ),
        } as BeginMfaPasskeyResult)
      )
    );

    const res = await POST();

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      ceremonyId: string;
      options: unknown;
    };
    expect(payload.ceremonyId).toBe('cer-1');
    expect(payload.options).toEqual({ challenge: 'abc' });
  });

  it('returns 401 with challenge_expired and clears the mfa cookie when the challenge is dead', async () => {
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

    const res = await POST();

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('challenge_expired');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('');
  });

  it('falls through to mapPactAuthError for a code it does not special-case', async () => {
    cookieJar.set(MFA_TOKEN_COOKIE, 'real-challenge-token');
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.reject(
          new ConnectError('too many attempts', Code.ResourceExhausted)
        )
      )
    );

    const res = await POST();

    expect(res.status).toBe(429);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('rate_limited');
  });
});

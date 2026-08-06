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

type FinishPasskeyRegistrationResult = Awaited<
  ReturnType<ReturnType<typeof getPactAuthClient>['finishPasskeyRegistration']>
>;
const fakeAuthClient = (
  finishPasskeyRegistration: () => Promise<FinishPasskeyRegistrationResult>
) =>
  ({ finishPasskeyRegistration }) as unknown as ReturnType<
    typeof getPactAuthClient
  >;

const SESSION_COOKIE = 'pact_session';

const makeRequest = (body: unknown) =>
  new NextRequest('http://localhost:3000/api/auth/passkey/register/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

const validBody = { ceremonyId: 'cer-1', attestation: { id: 'cred-1' } };

const mockGetPactAuthClient = vi.mocked(getPactAuthClient);

describe('POST /api/auth/passkey/register/finish', () => {
  beforeEach(() => {
    mockGetPactAuthClient.mockReset();
    cookieJar = new Map();
    cookieJar.set(SESSION_COOKIE, 'real-session-token');
  });

  it('returns 401 when there is no session cookie', async () => {
    cookieJar = new Map();

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(401);
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('returns 400 when ceremonyId is missing', async () => {
    const res = await POST(makeRequest({ attestation: { id: 'cred-1' } }));

    expect(res.status).toBe(400);
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  it('returns 400 when attestation is missing', async () => {
    const res = await POST(makeRequest({ ceremonyId: 'cer-1' }));

    expect(res.status).toBe(400);
    expect(mockGetPactAuthClient).not.toHaveBeenCalled();
  });

  // The whole point of PACT-714: recoveryCodes must survive the hop from
  // the pact-auth client's result to the JSON body the browser reads.
  it('includes recoveryCodes when pact-auth issues them', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          credentialId: 'cred-1',
          recoveryCodes: ['aaa111', 'bbb222'],
        } as FinishPasskeyRegistrationResult)
      )
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    const payload = (await res.json()) as {
      credentialId: string;
      recoveryCodes?: string[];
    };
    expect(payload).toEqual({
      credentialId: 'cred-1',
      recoveryCodes: ['aaa111', 'bbb222'],
    });
  });

  // A TOTP user adding a passkey already has recovery codes provisioned -
  // pact-auth never rotates them, so the field must be entirely absent
  // here, not present-but-empty.
  it('omits recoveryCodes entirely when pact-auth issues none', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          credentialId: 'cred-2',
        } as FinishPasskeyRegistrationResult)
      )
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    const payload = (await res.json()) as Record<string, unknown>;
    expect(payload).toEqual({ credentialId: 'cred-2' });
    expect('recoveryCodes' in payload).toBe(false);
  });

  it('returns 409 when the credential is already registered', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.reject(
          new ConnectError('already registered', Code.AlreadyExists)
        )
      )
    );

    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(409);
  });
});

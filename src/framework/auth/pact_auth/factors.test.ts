import { afterEach, describe, expect, it, vi } from 'vitest';

// listMfaFactors/listPasskeys/listIdentities/hasWebAuthnFactor read the
// session token via next/headers' cookies() (request context) - same
// mocking shape as route_helpers.test.ts in this directory.
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

const listMfaFactorsMock = vi.fn();
const listPasskeysMock = vi.fn();
const listIdentitiesMock = vi.fn();
vi.mock('./client', () => ({
  getPactAuthClient: () => ({
    listMfaFactors: listMfaFactorsMock,
    listPasskeys: listPasskeysMock,
    listIdentities: listIdentitiesMock,
  }),
}));

import {
  hasWebAuthnFactor,
  listIdentities,
  listMfaFactors,
  listPasskeys,
} from './factors';
import { MOCK_SESSION_TOKEN } from './mock';

const SESSION_COOKIE = 'pact_session';

describe('listMfaFactors', () => {
  afterEach(() => {
    cookieJar = new Map();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns an empty list without calling pact-auth when no cookie is set', async () => {
    cookieJar = new Map();

    await expect(listMfaFactors()).resolves.toEqual([]);
    expect(listMfaFactorsMock).not.toHaveBeenCalled();
  });

  it('filters to TOTP factors and maps fields when a real session cookie is set', async () => {
    cookieJar = new Map([[SESSION_COOKIE, 'real-token']]);
    listMfaFactorsMock.mockResolvedValue({
      factors: [
        {
          factorId: 'f-1',
          type: 'totp',
          label: 'Authenticator app',
          verified: true,
          createdAtUnix: 1700000000,
        },
        {
          factorId: 'f-2',
          type: 'webauthn',
          label: 'Security key',
          verified: true,
          createdAtUnix: 1700000000,
        },
      ],
    });

    const result = await listMfaFactors();

    expect(listMfaFactorsMock).toHaveBeenCalledWith({
      sessionToken: 'real-token',
    });
    expect(result).toEqual([
      {
        factorId: 'f-1',
        type: 'totp',
        label: 'Authenticator app',
        verified: true,
        createdAt: new Date(1700000000 * 1000),
      },
    ]);
  });

  it('fails closed to an empty list when the pact-auth call throws', async () => {
    cookieJar = new Map([[SESSION_COOKIE, 'real-token']]);
    listMfaFactorsMock.mockRejectedValue(new Error('pact-auth unreachable'));

    await expect(listMfaFactors()).resolves.toEqual([]);
  });

  // Regression test for PACT-717: dev:mock's auto-login never sets a real
  // pact_session cookie (validateSessionFromCookies short-circuits before
  // ever touching cookies - see session.ts), so a fresh mock session used
  // to hit the "no cookie" branch above and silently return [] even though
  // src/app/auth/mock/data/auth.ts had already seeded a passkey, an
  // identity, and a recovery-codes row into the MockRepository. Fails
  // before the fix (this exact assertion returned [] with the client never
  // called), passes after it.
  it('falls back to the shared mock session token in mock mode with no cookie set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    cookieJar = new Map();
    listMfaFactorsMock.mockResolvedValue({
      factors: [
        {
          factorId: 'mock-factor-1',
          type: 'totp',
          label: 'Authenticator app',
          verified: true,
          createdAtUnix: 1700000000,
        },
      ],
    });

    const result = await listMfaFactors();

    expect(listMfaFactorsMock).toHaveBeenCalledWith({
      sessionToken: MOCK_SESSION_TOKEN,
    });
    expect(result).toHaveLength(1);
  });
});

describe('listPasskeys', () => {
  afterEach(() => {
    cookieJar = new Map();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns an empty list without calling pact-auth when no cookie is set', async () => {
    cookieJar = new Map();

    await expect(listPasskeys()).resolves.toEqual([]);
    expect(listPasskeysMock).not.toHaveBeenCalled();
  });

  it('maps lastUsedAtUnix of 0 to null ("never used")', async () => {
    cookieJar = new Map([[SESSION_COOKIE, 'real-token']]);
    listPasskeysMock.mockResolvedValue({
      passkeys: [
        {
          passkeyId: 'p-1',
          label: 'MacBook Touch ID',
          createdAtUnix: 1700000000,
          lastUsedAtUnix: 0,
        },
      ],
    });

    const result = await listPasskeys();

    expect(result).toEqual([
      {
        passkeyId: 'p-1',
        label: 'MacBook Touch ID',
        createdAt: new Date(1700000000 * 1000),
        lastUsedAt: null,
      },
    ]);
  });

  // Regression test for PACT-717 (see listMfaFactors' matching test above
  // for the full explanation): a fresh dev:mock session now sees the
  // seeded passkey without a manual login round trip.
  it('falls back to the shared mock session token in mock mode with no cookie set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    cookieJar = new Map();
    listPasskeysMock.mockResolvedValue({
      passkeys: [
        {
          passkeyId: 'mock-passkey-1',
          label: 'MacBook Touch ID',
          createdAtUnix: 1700000000,
          lastUsedAtUnix: 1700000000,
        },
      ],
    });

    const result = await listPasskeys();

    expect(listPasskeysMock).toHaveBeenCalledWith({
      sessionToken: MOCK_SESSION_TOKEN,
    });
    expect(result).toHaveLength(1);
  });
});

describe('listIdentities', () => {
  afterEach(() => {
    cookieJar = new Map();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('returns an empty list without calling pact-auth when no cookie is set', async () => {
    cookieJar = new Map();

    await expect(listIdentities()).resolves.toEqual([]);
    expect(listIdentitiesMock).not.toHaveBeenCalled();
  });

  // Regression test for PACT-717 (see listMfaFactors' matching test above
  // for the full explanation): a fresh dev:mock session now sees the
  // seeded GitHub identity without a manual login round trip.
  it('falls back to the shared mock session token in mock mode with no cookie set', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    cookieJar = new Map();
    listIdentitiesMock.mockResolvedValue({
      identities: [
        {
          provider: 'github',
          providerUid: 'mock-user-1',
          connectedAtUnix: 1700000000,
        },
      ],
    });

    const result = await listIdentities();

    expect(listIdentitiesMock).toHaveBeenCalledWith({
      sessionToken: MOCK_SESSION_TOKEN,
    });
    expect(result).toHaveLength(1);
  });
});

describe('hasWebAuthnFactor', () => {
  afterEach(() => {
    cookieJar = new Map();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('stays coherent (false, no client calls) in real mode with no session cookie', async () => {
    cookieJar = new Map();

    await expect(hasWebAuthnFactor()).resolves.toBe(false);
    expect(listPasskeysMock).not.toHaveBeenCalled();
    expect(listMfaFactorsMock).not.toHaveBeenCalled();
  });

  it('is true in mock mode once the seeded passkey becomes visible', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    cookieJar = new Map();
    listPasskeysMock.mockResolvedValue({
      passkeys: [
        {
          passkeyId: 'mock-passkey-1',
          label: 'MacBook Touch ID',
          createdAtUnix: 1700000000,
          lastUsedAtUnix: 1700000000,
        },
      ],
    });

    await expect(hasWebAuthnFactor()).resolves.toBe(true);
  });

  it('falls back to a verified webauthn MFA factor when there are no passkeys', async () => {
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');
    cookieJar = new Map();
    listPasskeysMock.mockResolvedValue({ passkeys: [] });
    listMfaFactorsMock.mockResolvedValue({
      factors: [
        {
          factorId: 'f-1',
          type: 'webauthn',
          label: 'Security key',
          verified: true,
          createdAtUnix: 1700000000,
        },
      ],
    });

    await expect(hasWebAuthnFactor()).resolves.toBe(true);
  });
});

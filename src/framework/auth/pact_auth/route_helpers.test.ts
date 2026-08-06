import { describe, expect, it, vi } from 'vitest';

// getMfaToken/getSessionToken read via next/headers' cookies() (request
// context), not a NextRequest - see route.test.ts files under
// app/api/auth/* for the equivalent pattern at the route-handler layer.
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

import {
  challengeExpiredResponse,
  getMfaToken,
  isChallengeGoneMessage,
  noMfaChallengeResponse,
  parseCeremonyOptions,
} from './route_helpers';

const MFA_TOKEN_COOKIE = 'pact_mfa_token';

describe('getMfaToken', () => {
  it('returns undefined when the cookie is absent', async () => {
    cookieJar = new Map();

    await expect(getMfaToken()).resolves.toBeUndefined();
  });

  it('returns the cookie value when present', async () => {
    cookieJar = new Map([[MFA_TOKEN_COOKIE, 'real-challenge-token']]);

    await expect(getMfaToken()).resolves.toBe('real-challenge-token');
  });
});

describe('noMfaChallengeResponse', () => {
  it('returns a 401 with the no_challenge code', async () => {
    const res = noMfaChallengeResponse();

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('no_challenge');
  });
});

describe('challengeExpiredResponse', () => {
  it('returns a 401 with the challenge_expired code and clears the mfa cookie', async () => {
    const res = challengeExpiredResponse();

    expect(res.status).toBe(401);
    const payload = (await res.json()) as { code: string };
    expect(payload.code).toBe('challenge_expired');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('');
  });
});

describe('isChallengeGoneMessage', () => {
  it.each([
    ['MFA challenge invalid or expired', true],
    ['challenge expired', true],
    ['CHALLENGE ALREADY CONSUMED', true],
    ['invalid MFA code', false],
    ['passkey verification failed', false],
  ])('classifies %j as challenge-gone: %s', (raw, expected) => {
    expect(isChallengeGoneMessage(raw)).toBe(expected);
  });
});

describe('parseCeremonyOptions', () => {
  const encode = (value: unknown): Uint8Array =>
    new TextEncoder().encode(JSON.stringify(value));

  it('unwraps a go-webauthn CredentialAssertion envelope', () => {
    const result = parseCeremonyOptions(
      encode({ publicKey: { challenge: 'abc' }, mediation: 'optional' })
    );

    expect(result).toEqual({ ok: true, options: { challenge: 'abc' } });
  });

  it('passes through options with no publicKey wrapper unchanged', () => {
    const result = parseCeremonyOptions(encode({ challenge: 'abc' }));

    expect(result).toEqual({ ok: true, options: { challenge: 'abc' } });
  });

  it('returns ok:false for undecodable bytes', () => {
    const result = parseCeremonyOptions(new Uint8Array([0xff, 0xfe, 0xfd]));

    expect(result.ok).toBe(false);
  });
});

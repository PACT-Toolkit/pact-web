import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getPactAuthClient } from '@/src/framework/auth/pact_auth/client';

import { GET } from './route';

vi.mock('@/src/framework/auth/pact_auth/client', () => ({
  getPactAuthClient: vi.fn(),
}));

// The route only ever calls `.handleCallback(...)` on the client, so the
// fake only needs to implement that one method — cast it to the full
// generated Client type rather than mocking the other 27 RPCs.
type HandleCallbackResult = Awaited<
  ReturnType<ReturnType<typeof getPactAuthClient>['handleCallback']>
>;
const fakeAuthClient = (handleCallback: () => Promise<HandleCallbackResult>) =>
  ({ handleCallback }) as unknown as ReturnType<typeof getPactAuthClient>;

const STATE_COOKIE = 'pact_oauth_state';
const SESSION_COOKIE = 'pact_session';
const MFA_TOKEN_COOKIE = 'pact_mfa_token';
const OAUTH_RETURN_TO_COOKIE = 'pact_oauth_return_to';

const makeRequest = (searchParams: Record<string, string> = {}) => {
  const url = new URL('http://localhost:3000/v1/auth/callback/github');
  for (const [k, v] of Object.entries({
    code: 'the-code',
    state: 'the-state',
    ...searchParams,
  })) {
    url.searchParams.set(k, v);
  }

  return new NextRequest(url, {
    headers: { cookie: `${STATE_COOKIE}=signed-state-value` },
  });
};

const callGet = (req: NextRequest) =>
  GET(req, { params: Promise.resolve({ provider: 'github' }) });

const mockGetPactAuthClient = vi.mocked(getPactAuthClient);

describe('GET /v1/auth/callback/[provider]', () => {
  beforeEach(() => {
    mockGetPactAuthClient.mockReset();
  });

  it('sets the session cookie and redirects to return_to when MFA is not required', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: 'real-session-token',
          userId: 'user-1',
          expiresAtUnix: BigInt(Math.floor(Date.now() / 1000) + 3600),
          returnTo: 'http://localhost:3000/settings/billing',
          refreshToken: 'refresh-token',
          mfaRequired: false,
          mfaToken: '',
        } as HandleCallbackResult)
      )
    );

    const res = await callGet(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe(
      'http://localhost:3000/settings/billing'
    );
    expect(res.cookies.get(SESSION_COOKIE)?.value).toBe('real-session-token');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)).toBeUndefined();
    expect(res.cookies.get(OAUTH_RETURN_TO_COOKIE)).toBeUndefined();
    // One-shot state cookie is always burned.
    expect(res.cookies.get(STATE_COOKIE)?.value).toBe('');
  });

  it('sets the mfa cookie, carries return_to, and skips the session cookie when MFA is required', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: '',
          userId: 'user-1',
          expiresAtUnix: BigInt(0),
          returnTo: 'http://localhost:3000/settings/billing',
          refreshToken: '',
          mfaRequired: true,
          mfaToken: 'challenge-token',
        } as HandleCallbackResult)
      )
    );

    const res = await callGet(makeRequest());

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/login/mfa');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)?.value).toBe('challenge-token');
    expect(res.cookies.get(OAUTH_RETURN_TO_COOKIE)?.value).toBe(
      'http://localhost:3000/settings/billing'
    );
    expect(res.cookies.get(SESSION_COOKIE)).toBeUndefined();
    expect(res.cookies.get(STATE_COOKIE)?.value).toBe('');
  });

  it('falls back to /login with an error reason when mfaRequired is true but mfaToken is empty', async () => {
    mockGetPactAuthClient.mockReturnValue(
      fakeAuthClient(() =>
        Promise.resolve({
          sessionToken: '',
          userId: 'user-1',
          expiresAtUnix: BigInt(0),
          returnTo: 'http://localhost:3000/settings/billing',
          refreshToken: '',
          mfaRequired: true,
          mfaToken: '',
        } as HandleCallbackResult)
      )
    );

    const res = await callGet(makeRequest());

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get('location')!);
    expect(location.pathname).toBe('/login');
    expect(location.searchParams.get('oauth_error')).toBe('mfa_token_missing');
    expect(res.cookies.get(MFA_TOKEN_COOKIE)).toBeUndefined();
    expect(res.cookies.get(OAUTH_RETURN_TO_COOKIE)).toBeUndefined();
    expect(res.cookies.get(STATE_COOKIE)?.value).toBe('');
  });
});

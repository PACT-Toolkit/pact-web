import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET } from './route';

vi.mock('server-only', () => ({}));
vi.mock('@/src/framework/auth/pact_auth/client', () => ({
  getPactAuthClient: vi.fn(),
}));

const makeRequest = (provider: string) =>
  new NextRequest(
    `http://localhost:3000/api/auth/oauth/start?provider=${provider}`
  );

describe('GET /api/auth/oauth/start', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects an id that is not a known provider', async () => {
    const res = await GET(makeRequest('okta'));

    expect(res.status).toBe(400);
  });

  it.each([
    ['none', 'github'],
    ['google', 'github'],
    ['github', 'meta'],
  ])(
    'with PACT_AUTH_OAUTH_PROVIDERS=%s redirects %s to the unknown_provider login error',
    async (enabled, provider) => {
      vi.stubEnv('PACT_AUTH_OAUTH_PROVIDERS', enabled);

      const res = await GET(makeRequest(provider));

      expect(res.status).toBe(307);
      const location = new URL(res.headers.get('location') ?? '');
      expect(location.pathname).toBe('/login');
      expect(location.searchParams.get('oauth_error')).toBe('unknown_provider');
      expect(res.cookies.getAll()).toEqual([]);
    }
  );

  it('lets an enabled provider through to the mock callback', async () => {
    vi.stubEnv('PACT_AUTH_OAUTH_PROVIDERS', 'github');
    vi.stubEnv('NEXT_PUBLIC_API_MOCKING', 'enabled');

    const res = await GET(makeRequest('github'));

    expect(new URL(res.headers.get('location') ?? '').pathname).toBe(
      '/v1/auth/callback/github'
    );
  });
});

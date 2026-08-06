import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { redeemRefreshToken } from './refresh_session';

// PACT-726: redeemRefreshToken is the Edge-safe replacement for calling
// client.ts's refreshSession from proxy.ts (client.ts imports next/headers,
// which middleware can't use). These tests exercise it directly against a
// stubbed fetch - same pattern proxy_to_gateway.test.ts already uses for the
// sibling PACT-705 rotation logic.
describe('redeemRefreshToken', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('PACT_GATEWAY_URL', 'http://gateway.test');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('posts the refresh token header to pact-gateway session/refresh and returns the new pair', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionToken: 'new-session',
          refreshToken: 'new-refresh',
          userId: 'user-1',
          expiresAtUnix: 1_700_000_000,
        }),
        { status: 200 }
      )
    );

    const result = await redeemRefreshToken('old-refresh');

    expect(result).toEqual({
      sessionToken: 'new-session',
      refreshToken: 'new-refresh',
      expiresAtUnix: 1_700_000_000,
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://gateway.test/v1/auth/session/refresh');
    expect(init?.method).toBe('POST');
    expect(new Headers(init?.headers).get('x-pact-refresh-token')).toBe(
      'old-refresh'
    );
  });

  it('forwards the client IP as X-Forwarded-For when provided', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionToken: 's',
          refreshToken: 'r',
          expiresAtUnix: 1,
        }),
        { status: 200 }
      )
    );

    await redeemRefreshToken('tok', '203.0.113.5');

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(
      '203.0.113.5'
    );
  });

  it('returns null on a 401 (invalid, expired, or already-used token)', async () => {
    fetchMock.mockResolvedValue(
      new Response('unauthenticated', { status: 401 })
    );

    expect(await redeemRefreshToken('bad-token')).toBeNull();
  });

  it('returns null on a 400 (malformed request)', async () => {
    fetchMock.mockResolvedValue(new Response('bad request', { status: 400 }));

    expect(await redeemRefreshToken('bad-token')).toBeNull();
  });

  it('returns null when the response body is missing required fields', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ userId: 'user-1' }), { status: 200 })
    );

    expect(await redeemRefreshToken('tok')).toBeNull();
  });

  it('returns null (fails closed) when the network call throws', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    expect(await redeemRefreshToken('tok')).toBeNull();
  });

  // Concurrent-refresh hazard (see this module's docblock): several
  // navigations/prefetches racing on the same missing-session-cookie state
  // share one refresh token. Presenting it twice would trip pact-auth's
  // reuse detection and revoke the whole session, so concurrent callers
  // must collapse into a single upstream call.
  it('single-flights concurrent redemption of the same refresh token', async () => {
    let resolveFetch!: (res: Response) => void;
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      })
    );

    const first = redeemRefreshToken('shared-token');
    const second = redeemRefreshToken('shared-token');

    resolveFetch(
      new Response(
        JSON.stringify({
          sessionToken: 's',
          refreshToken: 'r',
          expiresAtUnix: 1,
        }),
        { status: 200 }
      )
    );

    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(firstResult).toEqual(secondResult);
  });

  it('does not dedupe concurrent redemption of different refresh tokens', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionToken: 's',
          refreshToken: 'r',
          expiresAtUnix: 1,
        }),
        { status: 200 }
      )
    );

    await Promise.all([
      redeemRefreshToken('token-a'),
      redeemRefreshToken('token-b'),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('allows a fresh redemption after a prior one for the same token has resolved', async () => {
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({
          sessionToken: 's',
          refreshToken: 'r',
          expiresAtUnix: 1,
        }),
        { status: 200 }
      )
    );

    await redeemRefreshToken('token-a');
    await redeemRefreshToken('token-a');

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { proxyToGateway } from './proxy_to_gateway';

// proxyToGateway had no dedicated test file before PACT-687 - every route
// that uses it (app/v1/account/[...path]/route.ts and friends) mocks it
// at the module boundary instead. These tests cover the shared core
// directly against a stubbed fetch.
const makeRequest = (headers: Record<string, string> = {}) =>
  new NextRequest('http://localhost:3000/v1/account/profile', {
    method: 'GET',
    headers,
  });

describe('proxyToGateway', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('PACT_GATEWAY_URL', 'http://gateway.test');
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  // PACT-687: pact-gateway keys its per-IP rate buckets on the right-most
  // X-Forwarded-For hop, so this proxy must append its own determination
  // of the end-user's client IP as that one hop.
  it('appends the right-most inbound X-Forwarded-For hop to the outbound header', async () => {
    await proxyToGateway(
      makeRequest({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18' }),
      { upstreamPath: '/v1/account/profile' }
    );

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(
      '70.41.3.18'
    );
  });

  it('falls back to X-Real-IP when the inbound request has no X-Forwarded-For', async () => {
    await proxyToGateway(makeRequest({ 'x-real-ip': '198.51.100.9' }), {
      upstreamPath: '/v1/account/profile',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(
      '198.51.100.9'
    );
  });

  it('sends no X-Forwarded-For header when the inbound request has neither header', async () => {
    await proxyToGateway(makeRequest(), {
      upstreamPath: '/v1/account/profile',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).has('x-forwarded-for')).toBe(false);
  });

  // PACT-705: pact_refresh_token is now a real httpOnly cookie the auth
  // routes set alongside pact_session, and this proxy attaches it as
  // X-Pact-Refresh-Token on every call (no more per-route opt-in) so
  // pact-gateway's authMiddleware can silently renew a near-expiry session.
  it('attaches Authorization and X-Pact-Refresh-Token from the session and refresh cookies', async () => {
    await proxyToGateway(
      makeRequest({
        cookie: 'pact_session=sess-1; pact_refresh_token=ref-1',
      }),
      { upstreamPath: '/v1/account/profile' }
    );

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer sess-1');
    expect(headers.get('x-pact-refresh-token')).toBe('ref-1');
  });

  it('does not attach X-Pact-Refresh-Token when there is no refresh cookie', async () => {
    await proxyToGateway(makeRequest({ cookie: 'pact_session=sess-1' }), {
      upstreamPath: '/v1/account/profile',
    });

    const [, init] = fetchMock.mock.calls[0];
    expect(new Headers(init?.headers).has('x-pact-refresh-token')).toBe(false);
  });

  it('rotates both cookies from the gateway rotated-session response headers', async () => {
    const futureUnix = Math.floor(Date.now() / 1000) + 3600;
    fetchMock.mockResolvedValueOnce(
      new Response(null, {
        status: 204,
        headers: {
          'x-pact-new-session-token': 'sess-2',
          'x-pact-new-refresh-token': 'ref-2',
          'x-pact-new-expires-at-unix': String(futureUnix),
        },
      })
    );

    const res = await proxyToGateway(
      makeRequest({
        cookie: 'pact_session=sess-1; pact_refresh_token=ref-1',
      }),
      { upstreamPath: '/v1/account/profile' }
    );

    expect(res.cookies.get('pact_session')?.value).toBe('sess-2');
    expect(res.cookies.get('pact_refresh_token')?.value).toBe('ref-2');
  });

  // The CONCURRENT-REFRESH HAZARD documented on pact-gateway's
  // authMiddleware: refresh tokens are single-use, so presenting the same
  // one twice trips reuse-detection and revokes the whole token family.
  // Two requests racing in on the same pre-rotation session cookie must
  // not both attempt a refresh - only the first (the "leader") does, and
  // the second (the "follower") adopts the leader's rotated pair.
  it('single-flights the refresh across concurrent requests sharing the same session cookie', async () => {
    let resolveUpstream: (value: Response) => void = () => {};
    const upstreamPromise = new Promise<Response>((resolve) => {
      resolveUpstream = resolve;
    });
    fetchMock.mockImplementation(() => upstreamPromise);

    const cookieHeader = {
      cookie: 'pact_session=sess-1; pact_refresh_token=ref-1',
    };
    const p1 = proxyToGateway(makeRequest(cookieHeader), {
      upstreamPath: '/v1/account/profile',
    });
    const p2 = proxyToGateway(makeRequest(cookieHeader), {
      upstreamPath: '/v1/files',
    });

    // Both requests have already reached their fetch call synchronously
    // (each suspends at `await fetch(...)`) - only the leader (the first
    // to register) should carry the refresh header upstream.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, leaderInit] = fetchMock.mock.calls[0];
    const [, followerInit] = fetchMock.mock.calls[1];
    expect(new Headers(leaderInit?.headers).get('x-pact-refresh-token')).toBe(
      'ref-1'
    );
    expect(new Headers(followerInit?.headers).has('x-pact-refresh-token')).toBe(
      false
    );

    const futureUnix = Math.floor(Date.now() / 1000) + 3600;
    resolveUpstream(
      new Response(null, {
        status: 204,
        headers: {
          'x-pact-new-session-token': 'sess-2',
          'x-pact-new-refresh-token': 'ref-2',
          'x-pact-new-expires-at-unix': String(futureUnix),
        },
      })
    );

    const [res1, res2] = await Promise.all([p1, p2]);
    expect(res1.cookies.get('pact_session')?.value).toBe('sess-2');
    expect(res1.cookies.get('pact_refresh_token')?.value).toBe('ref-2');
    expect(res2.cookies.get('pact_session')?.value).toBe('sess-2');
    expect(res2.cookies.get('pact_refresh_token')?.value).toBe('ref-2');
  });
});

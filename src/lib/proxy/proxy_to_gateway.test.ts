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
});

import { Code, ConnectError } from '@connectrpc/connect';
import { headers as nextHeaders } from 'next/headers';
import type * as NextHeadersModule from 'next/headers';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { appendForwardedFor } from '@/src/lib/proxy/client_ip';

import { getPactAuthClient } from './client';

// Wraps the real next/headers so most tests exercise the actual
// "called outside a request scope" rejection (see the request-scope
// describe block below) with zero mocking, and the handful of tests that
// need an inbound header value can override it per-case with
// mockResolvedValueOnce.
vi.mock('next/headers', async (importOriginal) => {
  const actual = await importOriginal<typeof NextHeadersModule>();

  return { ...actual, headers: vi.fn(actual.headers) };
});

// client.ts is the one module in this migration (PACT-681) with genuinely
// new logic: every /api/auth/* route handler test mocks getPactAuthClient
// at the module boundary (see app/api/auth/login/route.test.ts and
// friends), so none of them exercise the request-building, response
// normalisation, or HTTP-status-to-ConnectError-code mapping this module
// now owns. These tests cover that gap directly against a stubbed
// `fetch`.
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const emptyResponse = (status: number): Response =>
  new Response(null, { status });

describe('getPactAuthClient', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('PACT_GATEWAY_URL', 'http://gateway.test');
    vi.mocked(nextHeaders).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('login posts to /v1/auth/login and normalises zero-valued fields', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ sessionToken: 'tok', userId: 'user-1' })
    );

    const result = await getPactAuthClient().login({
      email: 'a@example.com',
      password: 'hunter2',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://gateway.test/v1/auth/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({
      email: 'a@example.com',
      password: 'hunter2',
    });
    // Fields absent from the gateway's response come back as the same
    // zero values the old protobuf client always returned (never
    // undefined) - every route handler reads these unconditionally.
    expect(result).toEqual({
      sessionToken: 'tok',
      refreshToken: '',
      userId: 'user-1',
      expiresAtUnix: 0,
      mfaRequired: false,
      mfaToken: '',
      returnTo: '',
    });
  });

  it('attaches a Bearer header for session-authed methods', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ factors: [] }));

    await getPactAuthClient().listMfaFactors({ sessionToken: 'sess-1' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://gateway.test/v1/auth/mfa/factors');
    expect(init?.method).toBe('GET');
    const headers = new Headers(init?.headers);
    expect(headers.get('authorization')).toBe('Bearer sess-1');
  });

  it('resolves to undefined for a 204 No Content response', async () => {
    fetchMock.mockResolvedValue(emptyResponse(204));

    await expect(
      getPactAuthClient().revokeSession({ sessionToken: 'sess-1' })
    ).resolves.toBeUndefined();
  });

  it.each([
    [400, Code.InvalidArgument],
    [401, Code.Unauthenticated],
    [403, Code.PermissionDenied],
    [404, Code.NotFound],
    [409, Code.AlreadyExists],
    [429, Code.ResourceExhausted],
    [503, Code.Unavailable],
    [504, Code.DeadlineExceeded],
    [502, Code.Unknown],
  ])('maps HTTP %i to ConnectError code %s', async (status, expectedCode) => {
    fetchMock.mockResolvedValue(
      new Response('boom', { status, statusText: 'boom' })
    );

    const err = await getPactAuthClient()
      .login({ email: 'a@example.com', password: 'x' })
      .catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(ConnectError);
    expect((err as ConnectError).code).toBe(expectedCode);
  });

  it('throws Code.Unavailable when the gateway is unreachable', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    const err = await getPactAuthClient()
      .login({ email: 'a@example.com', password: 'x' })
      .catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(ConnectError);
    expect((err as ConnectError).code).toBe(Code.Unavailable);
  });

  it('validateSession resolves valid:false on a 200 response rather than throwing', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ valid: false }));

    await expect(
      getPactAuthClient().validateSession({ sessionToken: 'stale' })
    ).resolves.toEqual({ valid: false, userId: '', expiresAtUnix: 0 });
  });

  it('validateSession throws Unauthenticated on a 401 (session.ts treats this the same as valid:false)', async () => {
    fetchMock.mockResolvedValue(
      new Response('missing or malformed bearer token', { status: 401 })
    );

    const err = await getPactAuthClient()
      .validateSession({ sessionToken: '' })
      .catch((caught: unknown) => caught);

    expect(err).toBeInstanceOf(ConnectError);
    expect((err as ConnectError).code).toBe(Code.Unauthenticated);
  });

  it('round-trips WebAuthn ceremony JSON through the Uint8Array shim', async () => {
    const options = { challenge: 'abc', allowCredentials: [] };
    fetchMock.mockResolvedValue(
      jsonResponse({ ceremonyId: 'cer-1', optionsJson: options })
    );

    const begun = await getPactAuthClient().beginPasskeyLogin({
      email: 'a@example.com',
    });

    expect(begun.ceremonyId).toBe('cer-1');
    expect(JSON.parse(new TextDecoder().decode(begun.optionsJson))).toEqual(
      options
    );

    fetchMock.mockResolvedValue(jsonResponse({ sessionToken: 'tok' }));
    const assertion = { id: 'cred-1', response: {} };
    await getPactAuthClient().finishPasskeyLogin({
      ceremonyId: 'cer-1',
      assertionJson: new TextEncoder().encode(JSON.stringify(assertion)),
    });

    const [, finishInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(finishInit?.body as string)).toEqual({
      ceremonyId: 'cer-1',
      assertionJson: assertion,
    });
  });

  // PACT-687: pact-gateway keys its per-IP rate buckets on the right-most
  // X-Forwarded-For hop, so authRequest forwards its best determination of
  // the end-user's client IP - read via next/headers - as that one hop.
  describe('client IP forwarding (PACT-687)', () => {
    it('sends no X-Forwarded-For header outside a request scope, which is the default here', async () => {
      // No mockResolvedValueOnce override: this hits the real next/headers
      // implementation, which rejects with "called outside a request
      // scope" in this test environment (see the module-level vi.mock
      // above) - exactly the no-op path the try/catch in client.ts exists
      // for. None of the tests above needed to know this module reads
      // next/headers at all.
      fetchMock.mockResolvedValue(jsonResponse({ sessionToken: 'tok' }));

      await getPactAuthClient().login({
        email: 'a@example.com',
        password: 'x',
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(new Headers(init?.headers).has('x-forwarded-for')).toBe(false);
    });

    it('appends the right-most inbound X-Forwarded-For hop to the outbound header', async () => {
      vi.mocked(nextHeaders).mockResolvedValueOnce(
        new Headers({ 'x-forwarded-for': '203.0.113.5, 70.41.3.18' })
      );
      fetchMock.mockResolvedValue(jsonResponse({ sessionToken: 'tok' }));

      await getPactAuthClient().login({
        email: 'a@example.com',
        password: 'x',
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(
        '70.41.3.18'
      );
    });

    it('falls back to X-Real-IP when the inbound request has no X-Forwarded-For', async () => {
      vi.mocked(nextHeaders).mockResolvedValueOnce(
        new Headers({ 'x-real-ip': '198.51.100.9' })
      );
      fetchMock.mockResolvedValue(jsonResponse({ sessionToken: 'tok' }));

      await getPactAuthClient().login({
        email: 'a@example.com',
        password: 'x',
      });

      const [, init] = fetchMock.mock.calls[0];
      expect(new Headers(init?.headers).get('x-forwarded-for')).toBe(
        '198.51.100.9'
      );
    });

    // authRequest builds a fresh outbound Headers object on every call, so
    // it never has a pre-existing X-Forwarded-For value to protect in
    // practice today. This locks in the append-not-replace invariant on
    // the shared helper authRequest relies on for that value, directly,
    // so it can never regress even if a future outbound header source is
    // added.
    it('append-not-replace: the shared helper appends after an existing outbound value rather than replacing it', () => {
      expect(appendForwardedFor('203.0.113.5', '70.41.3.18')).toBe(
        '203.0.113.5, 70.41.3.18'
      );
    });
  });
});

import { describe, expect, it } from 'vitest';

import { defaultReturnTo, rebaseReturnTo, requestOrigin } from './return_to';

// We don't need a real NextRequest — only the bits the helper touches.
type FakeReq = {
  headers: Headers;
  nextUrl: URL;
};

const makeReq = (
  url: string,
  headers: Record<string, string> = {}
): FakeReq => ({
  headers: new Headers(headers),
  nextUrl: new URL(url),
});

const asNext = (r: FakeReq) =>
  r as unknown as Parameters<typeof requestOrigin>[0];

describe('requestOrigin', () => {
  it('reads the wire Host header', () => {
    const req = makeReq('http://localhost:3000/api/auth/verify', {
      host: '192.168.32.119:3000',
    });
    expect(requestOrigin(asNext(req))).toBe('http://192.168.32.119:3000');
  });

  it('prefers x-forwarded-host when set (proxied prod)', () => {
    const req = makeReq('http://internal.svc/api/auth/verify', {
      host: 'internal.svc',
      'x-forwarded-host': 'app.pact.example',
      'x-forwarded-proto': 'https',
    });
    expect(requestOrigin(asNext(req))).toBe('https://app.pact.example');
  });

  it('falls back to nextUrl.origin when Host is absent', () => {
    const req = makeReq('http://localhost:3000/api/auth/verify');
    expect(requestOrigin(asNext(req))).toBe('http://localhost:3000');
  });
});

describe('defaultReturnTo', () => {
  it('appends /dashboard to the inbound origin', () => {
    const req = makeReq('http://localhost:3000/api/auth/register', {
      host: '192.168.32.119:3000',
    });
    expect(defaultReturnTo(asNext(req))).toBe(
      'http://192.168.32.119:3000/dashboard'
    );
  });

  it('honors PACT_AUTH_DEFAULT_RETURN_TO when set', () => {
    const prev = process.env.PACT_AUTH_DEFAULT_RETURN_TO;
    process.env.PACT_AUTH_DEFAULT_RETURN_TO = 'https://app.pact.example/home';
    try {
      const req = makeReq('http://localhost:3000/api/auth/register', {
        host: 'whatever:1234',
      });
      expect(defaultReturnTo(asNext(req))).toBe(
        'https://app.pact.example/home'
      );
    } finally {
      if (prev === undefined) delete process.env.PACT_AUTH_DEFAULT_RETURN_TO;
      else process.env.PACT_AUTH_DEFAULT_RETURN_TO = prev;
    }
  });
});

describe('rebaseReturnTo', () => {
  // The vitest env always sets NODE_ENV=test; the rebase logic is gated
  // on 'development', so we flip it on/off explicitly per test below.
  const withEnv = <T>(
    env: Record<string, string | undefined>,
    fn: () => T
  ): T => {
    const prev: Record<string, string | undefined> = {};
    for (const k of Object.keys(env)) prev[k] = process.env[k];
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      return fn();
    } finally {
      for (const [k, v] of Object.entries(prev)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };

  it('rebases an absolute return_to onto the inbound origin (cross-device flow, dev)', () => {
    // Register-on-laptop stored localhost; verify-on-phone hits LAN. The
    // user must land on the LAN URL the phone can reach.
    withEnv({ NODE_ENV: 'development' }, () => {
      const req = makeReq(
        'http://localhost:3000/api/auth/verify-email?token=x',
        { host: '192.168.32.119:3000' }
      );
      const out = rebaseReturnTo(
        asNext(req),
        'http://localhost:3000/dashboard'
      );
      expect(out.toString()).toBe('http://192.168.32.119:3000/dashboard');
    });
  });

  it('preserves path AND query from the stored return_to', () => {
    withEnv({ NODE_ENV: 'development' }, () => {
      const req = makeReq(
        'http://localhost:3000/api/auth/verify-email?token=x',
        { host: '192.168.32.119:3000' }
      );
      const out = rebaseReturnTo(
        asNext(req),
        'http://localhost:3000/settings/billing?welcome=1'
      );
      expect(out.toString()).toBe(
        'http://192.168.32.119:3000/settings/billing?welcome=1'
      );
    });
  });

  it('handles a relative return_to', () => {
    withEnv({ NODE_ENV: 'development' }, () => {
      const req = makeReq(
        'http://localhost:3000/api/auth/verify-email?token=x',
        { host: '192.168.32.119:3000' }
      );
      const out = rebaseReturnTo(asNext(req), '/dashboard');
      expect(out.toString()).toBe('http://192.168.32.119:3000/dashboard');
    });
  });

  it('treats a malformed return_to as a path under the inbound origin', () => {
    withEnv({ NODE_ENV: 'development' }, () => {
      const req = makeReq(
        'http://localhost:3000/api/auth/verify-email?token=x',
        { host: 'localhost:3000' }
      );
      const out = rebaseReturnTo(asNext(req), 'dashboard');
      expect(out.toString()).toBe('http://localhost:3000/dashboard');
    });
  });

  it('IS A NO-OP IN PRODUCTION — refuses to honor attacker-controlled Host', () => {
    // Hostile upstream sends `Host: evil.example`. In prod we MUST land
    // on the URL pact-auth canonicalized through the allowlist, NOT the
    // attacker's host.
    withEnv(
      { NODE_ENV: 'production', PACT_AUTH_REBASE_RETURN_TO: undefined },
      () => {
        const req = makeReq(
          'https://app.pact.example/api/auth/verify-email?token=x',
          { host: 'evil.example' }
        );
        const out = rebaseReturnTo(
          asNext(req),
          'https://app.pact.example/dashboard'
        );
        expect(out.toString()).toBe('https://app.pact.example/dashboard');
      }
    );
  });

  it('opts back into rebase in non-dev when PACT_AUTH_REBASE_RETURN_TO=1', () => {
    withEnv({ NODE_ENV: 'production', PACT_AUTH_REBASE_RETURN_TO: '1' }, () => {
      const req = makeReq(
        'http://localhost:3000/api/auth/verify-email?token=x',
        { host: '192.168.32.119:3000' }
      );
      const out = rebaseReturnTo(
        asNext(req),
        'http://localhost:3000/dashboard'
      );
      expect(out.toString()).toBe('http://192.168.32.119:3000/dashboard');
    });
  });
});

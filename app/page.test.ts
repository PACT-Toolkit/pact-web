import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { validateSessionFromCookies } from '@/src/framework/auth/pact_auth/session';

import HomePage from './page';

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));
vi.mock('@/src/framework/auth/pact_auth/session', () => ({
  validateSessionFromCookies: vi.fn(),
}));

const mockSession = vi.mocked(validateSessionFromCookies);
type Session = Awaited<ReturnType<typeof validateSessionFromCookies>>;

describe('HomePage entry redirect', () => {
  beforeEach(() => {
    redirectMock.mockReset();
    mockSession.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each([
    ['logged out, splash unset', undefined, false, '/login'],
    ['logged in, splash unset', undefined, true, '/dashboard'],
    ['logged out, splash off', 'disabled', false, '/login'],
    ['logged out, splash enabled', 'enabled', false, '/login?intro=1'],
    ['logged in, splash enabled', 'enabled', true, '/dashboard?intro=1'],
  ])('%s', async (_label, splash, loggedIn, expected) => {
    if (splash !== undefined) vi.stubEnv('PACT_WEB_SPLASH', splash);
    mockSession.mockResolvedValue(loggedIn ? ({} as Session) : null);

    await HomePage();

    expect(redirectMock).toHaveBeenCalledExactlyOnceWith(expected);
  });
});

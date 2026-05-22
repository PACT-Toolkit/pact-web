import { describe, expect, it } from 'vitest';

import { handlers } from '@/mocks/handlers';

// Relative paths only match in the browser where MSW resolves against
// location.origin. On the Node side (setupServer / vitest / Next.js
// Server Components via instrumentation.ts) there is no origin, so a
// '/api/x' handler silently fails to match and the request leaks to the
// real backend. Always use the '*/...' glob so the same handler works
// in both environments.
describe('MSW handler URL patterns', () => {
  it('every http handler uses a glob pattern, not a leading-slash relative path', () => {
    const violations = handlers.reduce<string[]>((acc, handler) => {
      const { info } = handler as {
        info?: { method?: string; path?: unknown };
      };

      if (!info?.path || typeof info.path !== 'string') return acc;

      if (info.path.startsWith('/')) {
        return [...acc, `${info.method ?? 'HTTP'} ${info.path} — should use '*/...' glob`];
      }

      return acc;
    }, []);

    expect(violations).toEqual([]);
  });
});

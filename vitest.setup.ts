import { cleanup, configure } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from '@/mocks/server';

// findBy*/waitFor give up after 1 s by default, which a CPU-starved machine
// can exceed while a fetch, an SWR revalidation and a React commit all run
// late. 4 s stays below the 5 s test timeout, so a genuinely missing element
// still fails with Testing Library's diagnostic message instead of a bare
// test timeout.
configure({ asyncUtilTimeout: 4000 });

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
// Testing Library's auto-cleanup only registers itself when it detects a
// global `afterEach` (vitest.config.mts does not set `test.globals: true`, so
// afterEach here is an explicit import, not a global). Without this, every
// `render()` across a test file accumulates in the same jsdom document --
// harmless for tests asserting on unique text, but a latent collision for
// any test file whose renders can produce the same text twice (as multiple
// TestLabRunHistory rows do).
afterEach(() => cleanup());
afterAll(() => server.close());

// jsdom has no layout engine, so Radix Select's pointer-capture and
// scroll-into-view calls (used to manage its open/positioned state) throw
// without these - a standard shim for testing Radix's Select in jsdom. Node
// environment test files have no `window`, so guard on it.
beforeAll(() => {
  if (typeof window === 'undefined') return;
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

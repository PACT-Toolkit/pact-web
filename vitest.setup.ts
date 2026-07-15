import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { server } from '@/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
// Testing Library's auto-cleanup only registers itself when it detects a
// global `afterEach` (vitest.config.ts does not set `test.globals: true`, so
// afterEach here is an explicit import, not a global). Without this, every
// `render()` across a test file accumulates in the same jsdom document --
// harmless for tests asserting on unique text, but a latent collision for
// any test file whose renders can produce the same text twice (as multiple
// TestLabRunHistory rows do).
afterEach(() => cleanup());
afterAll(() => server.close());

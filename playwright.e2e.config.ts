// Full-stack Playwright config. Distinct from `playwright.config.ts`
// because the e2e suite requires real pact-auth + pact-gateway + Postgres
// running - the mock-based config (which is the default for `pnpm pw:run`)
// would silently skip the half of the flow that actually exercises
// pact-auth.
//
// Run with:
//   pnpm run pw:e2e
//
// Prereqs (the global setup will fail loudly if any are missing):
//   1. pact-auth services up:
//        cd ../pact-auth && make compose-up && make dev
//   2. pact-gateway up (pact-web's /api/auth/* routes proxy through it as
//      of PACT-681 - pact-auth alone is no longer enough):
//        cd ../pact-gateway && make dev
//   3. (optional) pact-notify in log mode so emails land on disk:
//        cd ../pact-notify && make dev DOPPLER_CONFIG=dev_log
//
// This config starts its own pact-web (dev:real) so PACT_GATEWAY_URL is
// wired correctly (pact-web no longer dials pact-auth directly - see
// PACT-681). `e2e/lib/seed.ts`'s own PACT_AUTH_GRPC_ADDR_E2E is unrelated:
// a separate, optional, Playwright-only var this suite's seed helpers use
// to reach pact-auth directly for test-fixture setup, not the app runtime
// path. If a dev server is already listening on $port, Playwright reuses
// it.

import { defineConfig, devices } from '@playwright/test';

const port = process.env.PLAYWRIGHT_PORT ?? '3000';
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  // Full-stack specs talk to one shared seeded user; running them in
  // parallel would have them step on each other's MFA enrollment state.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: `pnpm run dev:real -- --port ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stderr: 'pipe',
    stdout: 'pipe',
  },
});

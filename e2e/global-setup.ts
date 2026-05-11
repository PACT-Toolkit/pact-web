// Playwright global setup for the full-stack e2e suite. Runs once before
// any spec, in Node, so it can talk to pact-auth's gRPC API and Postgres
// directly to bring deterministic fixtures into existence.
//
// Why not do this in a beforeAll? Because the seeded state needs to
// outlive a single spec file and we want the same identity available
// across the suite (cheap re-runs, no per-spec registration churn).

import { seedVerifiedUser, TEST_USER } from './lib/seed';

const globalSetup = async (): Promise<void> => {
  try {
    await seedVerifiedUser();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      [
        `e2e global-setup failed: ${msg}`,
        '',
        'This suite requires pact-auth + Postgres to be running. Bring them up:',
        '  cd ../pact-auth && make compose-up && make dev',
        '',
        'And — if you want emails captured to disk instead of Brevo — also:',
        '  cd ../pact-notify && doppler run -p pact-notify -c dev_log -- make dev',
        '',
        `Seed identity: ${TEST_USER.email}`,
      ].join('\n')
    );
  }
};

export default globalSetup;

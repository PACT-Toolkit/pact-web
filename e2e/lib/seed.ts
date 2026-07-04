// Test fixtures + helpers shared across the full-stack Playwright specs.
// Anything here runs in Node (not in the browser), so we're free to talk
// to pact-auth's gRPC API and Postgres directly.
//
// The general pattern: seed deterministic state up-front, then drive the
// real UI against real pact-auth. Tests stay readable because they don't
// have to perform a 4-step register / verify / login dance just to get
// to the screen under test.

import { createClient, type Client } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { Client as PgClient } from 'pg';

import { AuthService } from '@/src/__codegen__/proto/auth_pb';

// Deterministic test identity. Lives under `example.test` so it can
// never accidentally collide with a real address (TLD reserved by
// RFC 6761), and never lands in a real outbound mail send because
// pact-notify will fail Brevo verification on these — but the spec
// flips pact-notify to `log` mode anyway via the seed step.
export const TEST_USER = {
  email: 'playwright-mfa@example.test',
  // Long enough to pass pact-auth's minimum length policy in
  // internal/credentials/policy.go.
  password: 'PlaywrightTotp!2024',
  displayName: 'Playwright MFA',
} as const;

const DEFAULT_GRPC = 'http://localhost:9090';
const DEFAULT_PG =
  'postgres://pact:pact@localhost:5432/pact_auth?sslmode=disable';

const grpcAddr = (): string =>
  process.env.PACT_AUTH_GRPC_ADDR_E2E ?? DEFAULT_GRPC;
const pgUrl = (): string =>
  process.env.PACT_AUTH_DATABASE_URL_E2E ?? DEFAULT_PG;

let cachedClient: Client<typeof AuthService> | undefined;

const getClient = (): Client<typeof AuthService> => {
  if (cachedClient) return cachedClient;
  const baseUrl = grpcAddr();
  cachedClient = createClient(AuthService, createGrpcTransport({ baseUrl }));

  return cachedClient;
};

// We strip `sslmode=disable` because node-postgres treats it as no-SSL
// by default and barfs on the query-string flag.
const pgConnectionString = (): string => {
  const raw = pgUrl();

  return raw.replace(/[?&]sslmode=[^&]+/i, '');
};

// withPg runs `fn` against a fresh pg connection and tears it down on
// any path. Avoids leaking connections during repeated test runs.
const withPg = async <T>(fn: (pg: PgClient) => Promise<T>): Promise<T> => {
  const pg = new PgClient({ connectionString: pgConnectionString() });
  await pg.connect();
  try {
    return await fn(pg);
  } finally {
    await pg.end();
  }
};

type SeedIdentity = {
  email: string;
  password: string;
  displayName: string;
};

// seedVerifiedUserWithCredentials idempotently provisions the given
// identity and flips email_verified_at on so the next login lands them
// straight on the dashboard without going through the verify-email
// handoff. Also tears down any MFA factors left behind by a prior run so
// the "Add authenticator app" button is visible on first paint.
//
// Parameterized (rather than hardcoded to TEST_USER) so specs that
// mutate credentials in a way TEST_USER can't safely absorb - e.g.
// completing a real password reset, which permanently changes the
// account's password - seed a disposable identity of their own instead
// of fighting over TEST_USER's fixed password with every other spec.
export const seedVerifiedUserWithCredentials = async (
  identity: SeedIdentity
): Promise<void> => {
  const client = getClient();
  try {
    await client.register({
      email: identity.email,
      password: identity.password,
      displayName: identity.displayName,
      returnTo: 'http://localhost:3000/dashboard',
    });
  } catch (err) {
    // ALREADY_EXISTS is the happy path on re-runs. Anything else is a
    // setup failure worth surfacing.
    const isAlready =
      err instanceof Error &&
      (err.message.toLowerCase().includes('already') ||
        err.message.toLowerCase().includes('exists'));
    if (!isAlready) throw err;
  }

  await withPg(async (pg) => {
    // We rely on the existence of `users.email_verified_at` and the
    // `mfa_factors`, `auth_tokens`, and `password_credentials` tables.
    // If pact-auth's schema changes meaningfully, this query is the
    // canary that screams first.
    const { rows } = await pg.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [identity.email]
    );
    if (rows.length === 0) {
      throw new Error(
        `seedVerifiedUserWithCredentials: user ${identity.email} not found after Register - is pact-auth wired to the right DB?`
      );
    }
    const userId = rows[0].id;

    await pg.query(
      `UPDATE users
         SET email_verified_at = COALESCE(email_verified_at, now())
       WHERE id = $1`,
      [userId]
    );

    // password_credentials uses failed_attempts (int) + locked_until.
    // Belt-and-braces reset in case a prior run wedged the account.
    await pg.query(
      `UPDATE password_credentials
         SET failed_attempts = 0,
             locked_until    = NULL
       WHERE user_id = $1`,
      [userId]
    );

    // Wipe any TOTP factors + leftover recovery codes / pending MFA
    // challenges so the spec sees a clean enrollment slate. recovery_codes
    // and mfa_challenges are user-scoped (not factor-scoped) and therefore
    // don't CASCADE off mfa_factors — we have to delete them explicitly.
    await pg.query(`DELETE FROM mfa_challenges WHERE user_id = $1`, [userId]);
    await pg.query(`DELETE FROM recovery_codes WHERE user_id = $1`, [userId]);
    await pg.query(`DELETE FROM mfa_factors WHERE user_id = $1`, [userId]);
  });
};

// seedVerifiedUser is the TEST_USER-bound convenience wrapper every
// existing spec uses. Specs that need their own identity (see the
// docstring above) call seedVerifiedUserWithCredentials directly instead.
export const seedVerifiedUser = (): Promise<void> =>
  seedVerifiedUserWithCredentials(TEST_USER);

// requestPasswordResetForEmail mints a real reset token via pact-auth's
// gRPC RequestPasswordReset, the same call the /forgot-password route
// handler makes server-side. We call it directly (instead of driving the
// browser through /forgot-password) because RequestPasswordReset validates
// `returnTo`'s origin against PACT_OAUTH_RETURN_TO_ALLOWLIST, and specs may
// run their browser against a dev-server port (e.g. 3100) that isn't on
// that allowlist. The returned token is an origin-independent signed
// opaque value (see internal/signedtoken in pact-auth) - minting it via a
// pre-approved origin like localhost:3000 and then redeeming it in a
// browser on a different port is exactly what an email link does anyway.
export const requestPasswordResetForEmail = async (
  email: string,
  returnTo = 'http://localhost:3000/reset-password'
): Promise<void> => {
  const client = getClient();
  await client.requestPasswordReset({ email, returnTo });
};

// resetMfaState wipes all MFA-related rows for the test user, regardless
// of whether the user exists. Cheaper than seedVerifiedUser when all you
// need between specs is a clean enrollment slate.
//
// pact-auth's BeginTOTPEnrollment rejects with FailedPrecondition if a
// non-revoked factor (pending OR verified) exists. We have to delete the
// rows outright — soft-revoking via UI would leave them present.
export const resetMfaState = async (): Promise<void> => {
  await withPg(async (pg) => {
    const { rows } = await pg.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [TEST_USER.email]
    );
    if (rows.length === 0) return;
    const userId = rows[0].id;

    await pg.query(`DELETE FROM mfa_challenges WHERE user_id = $1`, [userId]);
    await pg.query(`DELETE FROM recovery_codes WHERE user_id = $1`, [userId]);
    await pg.query(`DELETE FROM mfa_factors WHERE user_id = $1`, [userId]);
  });
};

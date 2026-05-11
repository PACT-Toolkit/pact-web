// Browser-driven MFA TOTP enrollment flow.
//
// Walks the same path a user would take from the security-settings page:
//   1. Sign in with the seeded password identity.
//   2. Open /settings/security and click "Add authenticator app".
//   3. Read the secret rendered on screen (the same secret a user would
//      scan into 1Password / Google Authenticator).
//   4. Compute the current TOTP code off that secret in-process and
//      type it into the 6-digit input.
//   5. Confirm the recovery-codes screen appears, then click "Done".
//   6. Assert the new factor surfaces on the settings page after
//      router.refresh().
//
// This proves the full enrollment loop:
//   - the new /api/auth/mfa/enroll/{begin,confirm} routes proxy correctly,
//   - pact-auth issues a real otpauth-compliant secret,
//   - the UI's six-digit input lands a code pact-auth accepts,
//   - recovery codes round-trip back to the browser,
//   - and ListMfaFactors picks up the freshly-verified row on refresh.

import { URL } from 'node:url';

import { expect, test, type Locator, type Page } from '@playwright/test';
import * as OTPAuth from 'otpauth';

import { resetMfaState, TEST_USER } from './lib/seed';

// Next.js' streaming SSR / HMR can leave aria-hidden orphan DOM trees
// from prior navigations under a long-running `pnpm dev:real`. We scope
// every locator to a visible element so `toBeVisible()` doesn't trip
// strict-mode on a duplicate that's already detached from the
// accessibility tree.
const visibleTestId = (page: Page, id: string): Locator =>
  page.locator(`[data-testid="${id}"]:visible`);

// computeTotpCode prefers the otpauth URL when it's rendered (it carries
// algorithm / digits / period as authoritative params), falling back to
// the bare secret with library defaults if the URL is malformed — which
// would only happen on a regression in pact-auth's BeginTOTPEnrollment
// response. Either way the TOTP we compute is what an authenticator app
// would show right now.
// Helpers shared by the enrollment specs and the login step-up specs.
// Keeping them here (not in lib/) so the spec file remains the single
// source of truth for the user-visible flow.

const fillPasswordLoginForm = async (page: Page): Promise<void> => {
  await page.locator('#email').fill(TEST_USER.email);
  await page.locator('#password').fill(TEST_USER.password);
};

const signInWithPassword = async (page: Page): Promise<void> => {
  await page.goto('/login');
  await fillPasswordLoginForm(page);
  await page.getByRole('button', { name: /sign in with password/i }).click();
};

type EnrolledFactor = {
  secret: string;
  otpauthUrl: string;
  recoveryCodes: string[];
};

// enrollTotpFromSettings drives the same UI a human would: opens the
// security page, clicks "Add authenticator app", reads the secret /
// otpauth URL off the verify panel, computes the current code, submits
// it, captures the recovery codes, and dismisses the panel. The test
// keeps the secret in scope so it can compute additional codes later
// (e.g. for the login step-up flow).
const enrollTotpFromSettings = async (page: Page): Promise<EnrolledFactor> => {
  await page.goto('/settings/security');
  await visibleTestId(page, 'totp-add').click();
  await visibleTestId(page, 'totp-begin').click();

  const secret = (
    await visibleTestId(page, 'totp-secret').textContent()
  )?.trim();
  const rawOtpauth = (
    await visibleTestId(page, 'totp-otpauth-url').textContent()
  )?.trim();
  const otpauthUrl = rawOtpauth?.replace(/^.*?(otpauth:\/\/)/, '$1');
  if (!secret || !otpauthUrl) {
    throw new Error('enrollTotpFromSettings: pact-auth returned no secret');
  }

  const code = computeTotpCode(otpauthUrl, secret);
  await visibleTestId(page, 'totp-code-input').fill(code);
  await visibleTestId(page, 'totp-verify').click();

  const recoveryPanel = page.locator(
    '[data-testid="totp-enroll-panel"][data-stage="recovery"]:visible'
  );
  // Wait for the recovery panel to render before scraping. allTextContents()
  // doesn't auto-retry, so without the explicit visibility gate we race
  // the stage transition and get an empty array.
  const firstRecoveryItem = recoveryPanel
    .getByTestId('totp-recovery-codes')
    .locator('li')
    .first();
  await expect(firstRecoveryItem).toBeVisible();
  const recoveryCodes = await recoveryPanel
    .getByTestId('totp-recovery-codes')
    .locator('li')
    .allTextContents();

  await visibleTestId(page, 'totp-enroll-done').click();

  return { secret, otpauthUrl, recoveryCodes };
};

const computeTotpCode = (
  otpauthUrl: string,
  fallbackSecret: string
): string => {
  try {
    const parsed = new URL(otpauthUrl);
    const params = parsed.searchParams;
    const secret = params.get('secret') ?? fallbackSecret;

    return new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secret),
      algorithm: (params.get('algorithm') ?? 'SHA1').toUpperCase(),
      digits: Number(params.get('digits') ?? 6),
      period: Number(params.get('period') ?? 30),
    }).generate();
  } catch {
    return new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(fallbackSecret),
    }).generate();
  }
};

test.describe('MFA TOTP enrollment', () => {
  // Wipe the user's MFA rows before every spec so each one starts on a
  // clean slate — neither a leftover pending factor (which would make
  // BeginTOTPEnrollment 409) nor a verified factor (which hides the
  // "Add authenticator" button).
  test.beforeEach(async () => {
    await resetMfaState();
  });

  test('user enrolls a TOTP factor and sees recovery codes', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/settings/security');
    // The settings cards use shadcn's CardTitle which renders a div,
    // not a heading — so we wait on the data-testid'd trigger instead
    // of getByRole('heading', ...).
    await expect(visibleTestId(page, 'totp-add')).toBeVisible();

    await visibleTestId(page, 'totp-add').click();
    await visibleTestId(page, 'totp-begin').click();

    const verifyPanel = page.locator(
      '[data-testid="totp-enroll-panel"][data-stage="verify"]:visible'
    );
    await expect(verifyPanel).toBeVisible();

    const secret = (
      await visibleTestId(page, 'totp-secret').textContent()
    )?.trim();
    const rawOtpauthText = (
      await visibleTestId(page, 'totp-otpauth-url').textContent()
    )?.trim();
    // The rendered cell contains an sr-only "otpauth URL: " label
    // followed by the actual otpauth:// URI. We strip everything before
    // the scheme so downstream URL parsing doesn't choke on the prefix.
    const otpauthUrl = rawOtpauthText?.replace(/^.*?(otpauth:\/\/)/, '$1');
    expect(secret, 'pact-auth returned an empty TOTP secret').toBeTruthy();
    expect(otpauthUrl, 'pact-auth returned an empty otpauth URL').toMatch(
      /^otpauth:\/\//
    );

    const code = computeTotpCode(otpauthUrl!, secret!);
    await visibleTestId(page, 'totp-code-input').fill(code);
    await visibleTestId(page, 'totp-verify').click();

    const recoveryPanel = page.locator(
      '[data-testid="totp-enroll-panel"][data-stage="recovery"]:visible'
    );
    await expect(recoveryPanel).toBeVisible();

    // pact-auth defaults to 10 recovery codes (see internal/mfa/service.go);
    // we assert "at least one" to stay forward-compatible with a config knob.
    const recoveryItems = recoveryPanel
      .getByTestId('totp-recovery-codes')
      .locator('li');
    await expect(recoveryItems.first()).toBeVisible();
    expect(await recoveryItems.count()).toBeGreaterThan(0);

    await visibleTestId(page, 'totp-enroll-done').click();

    // After "Done", SignInMethodsPanel calls router.refresh(), which
    // re-renders the page server-side. The new factor row should now be
    // listed AND the "Add authenticator" button should disappear because
    // pact-auth permits only one verified TOTP factor per user.
    await expect(
      page.getByText(/authenticator app \(totp\)/i).first()
    ).toBeVisible();
    // Use :visible so an HMR-orphaned (aria-hidden) duplicate from a
    // prior navigation doesn't keep this assertion from going to 0.
    await expect(visibleTestId(page, 'totp-add')).toHaveCount(0);
  });

  test('rejects a wrong code without consuming the enrollment', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.locator('#email').fill(TEST_USER.email);
    await page.locator('#password').fill(TEST_USER.password);
    await page.getByRole('button', { name: /sign in with password/i }).click();
    await page.waitForURL('**/dashboard');

    await page.goto('/settings/security');
    await expect(visibleTestId(page, 'totp-add')).toBeVisible();

    await visibleTestId(page, 'totp-add').click();
    await visibleTestId(page, 'totp-begin').click();
    await expect(
      page.locator(
        '[data-testid="totp-enroll-panel"][data-stage="verify"]:visible'
      )
    ).toBeVisible();

    await visibleTestId(page, 'totp-code-input').fill('000000');
    await visibleTestId(page, 'totp-verify').click();

    // Stays on the verify stage with a visible error. The pending row
    // remains in the DB until the TTL elapses (or the user revokes it),
    // so a follow-up valid code would still complete the same factor.
    await expect(visibleTestId(page, 'totp-error')).toBeVisible();
    await expect(
      page.locator(
        '[data-testid="totp-enroll-panel"][data-stage="verify"]:visible'
      )
    ).toBeVisible();
  });
});

// Step-up suite: drives the password+TOTP login flow end-to-end. Each
// spec enrols a fresh factor from scratch so the secret stays in scope —
// the secret isn't surfaced anywhere in the UI after enrolment, so the
// test has to capture it at the source.
test.describe('MFA TOTP login step-up', () => {
  test.beforeEach(async () => {
    await resetMfaState();
  });

  test('user with verified TOTP must enter a 6-digit code at sign-in', async ({
    page,
    context,
  }) => {
    await signInWithPassword(page);
    await page.waitForURL('**/dashboard');

    const { secret, otpauthUrl } = await enrollTotpFromSettings(page);

    // Clear cookies to simulate sign-out — exercising the real /logout
    // flow would add a second moving piece (it's a server action) that
    // this spec doesn't need to cover.
    await context.clearCookies();

    await signInWithPassword(page);
    await page.waitForURL('**/login/mfa');

    const code = computeTotpCode(otpauthUrl, secret);
    await visibleTestId(page, 'mfa-code-input').fill(code);
    await visibleTestId(page, 'mfa-verify').click();

    await page.waitForURL('**/dashboard');
  });

  test('wrong code stays on /login/mfa with an error', async ({
    page,
    context,
  }) => {
    await signInWithPassword(page);
    await page.waitForURL('**/dashboard');

    // We enrol just to put the user into "has verified TOTP" state.
    // The secret itself isn't used in this spec — we deliberately send
    // a wrong code to assert the failure UX.
    await enrollTotpFromSettings(page);

    await context.clearCookies();

    await signInWithPassword(page);
    await page.waitForURL('**/login/mfa');

    await visibleTestId(page, 'mfa-code-input').fill('000000');
    await visibleTestId(page, 'mfa-verify').click();

    // Stays on /login/mfa with an alert visible. The mfa_token cookie
    // is preserved on a wrong-code response so the user can retry
    // without re-entering their password.
    await expect(page).toHaveURL(/\/login\/mfa$/);
    await expect(page.getByRole('alert').first()).toBeVisible();
  });

  test('recovery code is accepted as a fallback at sign-in', async ({
    page,
    context,
  }) => {
    await signInWithPassword(page);
    await page.waitForURL('**/dashboard');

    const { recoveryCodes } = await enrollTotpFromSettings(page);
    expect(
      recoveryCodes.length,
      'enrollment must surface at least one recovery code'
    ).toBeGreaterThan(0);

    await context.clearCookies();

    await signInWithPassword(page);
    await page.waitForURL('**/login/mfa');

    await visibleTestId(page, 'mfa-toggle-mode').click();
    await visibleTestId(page, 'mfa-code-input').fill(recoveryCodes[0]!);
    await visibleTestId(page, 'mfa-verify').click();

    await page.waitForURL('**/dashboard');
  });
});

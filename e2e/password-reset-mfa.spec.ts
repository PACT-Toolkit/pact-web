// Full-stack Playwright spec for PACT-446: the password-reset confirm
// flow's MFA step-up gate. pact-auth PR #60 made ConfirmPasswordReset
// behave like Login for an MFA-enrolled user - it withholds the session
// and returns mfa_required=true + a short-lived mfa_token instead. This
// walks that exact path against a real pact-auth + pact-notify (log-mode)
// pair, the same infra e2e/mfa-totp.spec.ts uses for the analogous login
// step-up flow.
//
// Prereqs: see e2e/global-setup.ts - pact-auth + Postgres must be
// running, and pact-notify started with `DOPPLER_CONFIG=dev_log` so the
// reset-link email lands on disk instead of going to Brevo
// (e2e/lib/mail.ts reads the token off that file).
//
// Each test seeds its own disposable identity rather than the shared
// TEST_USER from lib/seed.ts: completing a real password reset
// permanently changes the account's password in pact-auth's database,
// and TEST_USER's fixed password is relied on by every other full-stack
// spec (e.g. e2e/mfa-totp.spec.ts's signInWithPassword helper).
//
// The reset request itself goes straight to pact-auth over gRPC
// (lib/seed.ts's requestPasswordResetForEmail) rather than through the
// /forgot-password UI: RequestPasswordReset validates the `returnTo`
// origin against PACT_OAUTH_RETURN_TO_ALLOWLIST, which may not include
// whatever port this spec's browser happens to be pointed at. The token
// pact-auth mints is origin-independent, so redeeming it against
// /reset-password here is exactly what a real user clicking the email
// link would do.

import { expect, test, type Locator, type Page } from '@playwright/test';
import * as OTPAuth from 'otpauth';

import { readLatestResetToken } from './lib/mail';
import {
  requestPasswordResetForEmail,
  seedVerifiedUserWithCredentials,
} from './lib/seed';

const visibleTestId = (page: Page, id: string): Locator =>
  page.locator(`[data-testid="${id}"]:visible`);

type Identity = { email: string; password: string; displayName: string };

// A fresh identity per test avoids any shared mutable state between test
// runs and between repeat-each iterations.
const freshIdentity = (): Identity => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    email: `playwright-reset-mfa-${suffix}@example.test`,
    password: 'PlaywrightReset!2024',
    displayName: 'Playwright Reset MFA',
  };
};

const completePasswordReset = async (
  page: Page,
  token: string,
  newPassword: string
): Promise<void> => {
  await page.goto(`/reset-password?token=${encodeURIComponent(token)}`);
  await page.locator('#password').fill(newPassword);
  await page.locator('#confirmPassword').fill(newPassword);
  await page.getByRole('button', { name: /reset password/i }).click();
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

// enrollTotpFromSettings mirrors the identical helper in mfa-totp.spec.ts
// (kept local rather than shared - see that file's docblock for why).
const enrollTotpFromSettings = async (
  page: Page,
  identity: Identity
): Promise<{ secret: string; otpauthUrl: string }> => {
  await page.goto('/login');
  await page.locator('#email').fill(identity.email);
  await page.locator('#password').fill(identity.password);
  await page.getByRole('button', { name: /sign in with password/i }).click();
  await page.waitForURL('**/dashboard');

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

  await expect(
    page.locator(
      '[data-testid="totp-enroll-panel"][data-stage="recovery"]:visible'
    )
  ).toBeVisible();
  await visibleTestId(page, 'totp-enroll-done').click();

  return { secret, otpauthUrl };
};

test.describe('Password reset MFA step-up', () => {
  test('user without MFA resets their password and lands straight on the dashboard', async ({
    page,
  }) => {
    const identity = freshIdentity();
    await seedVerifiedUserWithCredentials(identity);

    await requestPasswordResetForEmail(identity.email);
    const token = await readLatestResetToken(identity.email);

    const newPassword = 'PlaywrightResetDone!2024';
    await completePasswordReset(page, token, newPassword);

    await page.waitForURL('**/dashboard');
  });

  test('enrolled user completing a reset is routed to /login/mfa and only gets a session after verifying', async ({
    page,
    context,
  }) => {
    const identity = freshIdentity();
    await seedVerifiedUserWithCredentials(identity);

    const { secret, otpauthUrl } = await enrollTotpFromSettings(page, identity);

    // Sign out so the reset flow starts from a logged-out browser, same as
    // a user who forgot their password would actually be.
    await context.clearCookies();

    await requestPasswordResetForEmail(identity.email);
    const token = await readLatestResetToken(identity.email);

    const newPassword = 'PlaywrightResetDone!2024';
    await completePasswordReset(page, token, newPassword);

    // MFA gate: no session yet - the route withheld it and stashed the
    // mfa_token cookie instead, same contract as the login step-up.
    await page.waitForURL('**/login/mfa');
    await expect(page).not.toHaveURL(/\/dashboard/);

    const code = computeTotpCode(otpauthUrl, secret);
    await visibleTestId(page, 'mfa-code-input').fill(code);
    await visibleTestId(page, 'mfa-verify').click();

    // Session only materializes once the second factor clears.
    await page.waitForURL('**/dashboard');
  });
});

import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers PACT-326: rounds /policy out into a full policy console.
//
// - RuleEditor (PACT-234/312) already shipped rule authoring plus
//   publish/revoke; this spec verifies it still works hosted alongside the
//   new panels, it does not change RuleEditor itself.
// - PolicyTokenIssuePanel (new, PACT-319) mints a capability token via
//   POST /v1/policy/tokens.
// - PolicyEventsFeed (renamed from PolicyWorkbench, now backed by the
//   generated GET /v1/audit/policy-events client instead of a hand-rolled
//   fetch) renders the caller's pact.policy decisions, auto-refreshing
//   every 30s.
test.describe('Policy console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/policy');
    await expect(page.getByTestId('policy-events-feed')).toBeVisible();
    await expect(page.getByTestId('policy-event-row').first()).toBeVisible();
  });

  test('renders seeded policy decisions with verdict, agent/tool, and stats', async ({
    page,
  }) => {
    const rows = page.getByTestId('policy-event-row');
    await expect(rows.first()).toBeVisible();
    await expect(rows.first()).toContainText(/ALLOWED|DENIED/);

    // Seeded fixture (mock/handlers/policy.ts) has 4 allowed, 3 denied.
    await expect(page.getByText('Total events')).toBeVisible();
    const feed = page.getByTestId('policy-events-feed');
    await expect(feed).toContainText('7');
  });

  test('refresh button revalidates the policy decisions feed', async ({
    page,
  }) => {
    const refreshButton = page
      .getByTestId('policy-events-feed')
      .getByRole('button', { name: 'Refresh' });
    await expect(refreshButton).toBeEnabled();
    await refreshButton.click();
    await expect(page.getByTestId('policy-event-row').first()).toBeVisible();
  });

  test('rule editor publish/revoke actions still work hosted on /policy', async ({
    page,
  }) => {
    const ruleName = `console-check-${Date.now()}`;
    await page.locator('#rule-name').fill(ruleName);
    await page.locator('#rule-pack').fill('pack: v1\nrules: []');
    await page.getByRole('button', { name: 'Create rule' }).click();

    const ruleRow = page
      .getByTestId('policy-rule-row')
      .filter({ hasText: ruleName });
    await expect(ruleRow).toBeVisible();
    await expect(ruleRow).toContainText('DRAFT');

    await ruleRow.getByRole('button', { name: 'Publish' }).click();
    await expect(ruleRow).toContainText('PUBLISHED');

    await ruleRow.getByRole('button', { name: 'Revoke' }).click();
    await ruleRow.getByRole('button', { name: 'Confirm revoke' }).click();
    await expect(ruleRow).toContainText('REVOKED');
  });

  test('token issuance panel mints a capability token', async ({ page }) => {
    await page.getByTestId('token-agent-id').fill('agent-alpha');
    await page.getByTestId('token-tool-id').fill('tool-search');
    await page.getByTestId('token-scopes').fill('read, write');

    await page.getByTestId('token-issue-submit').click();

    const result = page.getByTestId('token-issue-result');
    await expect(result).toBeVisible();
    await expect(page.getByTestId('token-issue-value')).not.toBeEmpty();
    await expect(page.getByTestId('token-issue-expiry')).toContainText(
      'Expires'
    );
  });

  test('token issuance panel copies the minted token to the clipboard', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await page.getByTestId('token-agent-id').fill('agent-alpha');
    await page.getByTestId('token-tool-id').fill('tool-search');
    await page.getByTestId('token-scopes').fill('read');
    await page.getByTestId('token-issue-submit').click();

    const tokenValue = await page
      .getByTestId('token-issue-value')
      .textContent();

    await page.getByTestId('token-issue-copy').click();
    await expect(page.getByTestId('token-issue-copy')).toContainText('Copied');

    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText()
    );
    expect(clipboardText).toBe(tokenValue?.trim());
  });

  test('token issuance panel disables submit until scopes are provided', async ({
    page,
  }) => {
    await page.getByTestId('token-agent-id').fill('agent-alpha');
    await page.getByTestId('token-tool-id').fill('tool-search');

    await expect(page.getByTestId('token-issue-submit')).toBeDisabled();

    await page.getByTestId('token-scopes').fill('read');
    await expect(page.getByTestId('token-issue-submit')).toBeEnabled();
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    expect(results.violations).toEqual([]);
  });
});

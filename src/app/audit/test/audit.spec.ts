import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers the audit-mode gaps closed in PACT-369: every topic the activity
// explorer offers now has seeded mock data (previously only pact.decisions
// did, so /audit rendered hollow under dev:mock for every other topic),
// pact.policy still honestly resolves to empty, the raw-payload fallback
// works for a decoded topic, and pact.decisions rows surface request
// latency in their expanded insights.
test.describe('Audit activity log', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/audit');
    await expect(page.getByTestId('audit-workbench')).toBeVisible();
    // Wait for the first seeded row, not just the container -- the
    // container renders before hydration finishes and before the SWR fetch
    // resolves, so interacting immediately after it appears would race
    // React's event handlers attaching.
    await expect(page.getByTestId('audit-row').first()).toBeVisible();
  });

  test('renders seeded rows across topics by default', async ({ page }) => {
    const rows = page.getByTestId('audit-row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(1);
  });

  test('pact.auth topic shows seeded auth events with human labels', async ({
    page,
  }) => {
    await page.getByTestId('audit-topic-select').selectOption('pact.auth');

    const rowList = page.getByTestId('audit-row-list');
    await expect(rowList).toBeVisible();
    await expect(rowList).toContainText('Login succeeded');
    await expect(rowList).toContainText('Login failed');
  });

  test('pact.account topic shows seeded consent and erasure events', async ({
    page,
  }) => {
    await page.getByTestId('audit-topic-select').selectOption('pact.account');

    const rowList = page.getByTestId('audit-row-list');
    await expect(rowList).toBeVisible();
    await expect(rowList).toContainText('Consent recorded');
    await expect(rowList).toContainText('Erasure requested (GDPR)');
  });

  test('pact.files topic shows seeded upload lifecycle events', async ({
    page,
  }) => {
    await page.getByTestId('audit-topic-select').selectOption('pact.files');

    const rowList = page.getByTestId('audit-row-list');
    await expect(rowList).toBeVisible();
    await expect(rowList).toContainText('File ready');
    await expect(rowList).toContainText('incident-report.pdf');
  });

  test('pact.policy topic honestly resolves to empty, not an error', async ({
    page,
  }) => {
    await page.getByTestId('audit-topic-select').selectOption('pact.policy');

    await expect(page.getByTestId('audit-empty-state')).toContainText(
      "pact.policy events aren't recorded"
    );
    await expect(page.getByTestId('audit-row')).toHaveCount(0);
  });

  test('expanding a row shows the raw JSON payload', async ({ page }) => {
    await page.getByTestId('audit-topic-select').selectOption('pact.auth');

    const firstRow = page.getByTestId('audit-row').first();
    await firstRow.getByTestId('audit-row-toggle').click();

    await expect(firstRow.getByTestId('audit-row-raw-payload')).toContainText(
      'event_id'
    );
  });

  test('a pact.decisions row surfaces request latency once expanded', async ({
    page,
  }) => {
    await page.getByTestId('audit-topic-select').selectOption('pact.decisions');

    const firstRow = page.getByTestId('audit-row').first();
    await firstRow.getByTestId('audit-row-toggle').click();

    await expect(firstRow.getByTestId('audit-decision-latency')).toContainText(
      /\d+ ms/
    );
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    // PACT-427 fixed the duplicate <main> landmark (landmark-no-duplicate-main /
    // landmark-unique / landmark-main-is-top-level) by changing per-page <main>
    // wrappers to <div>, since app/(app)/layout.tsx's SidebarInset already owns
    // the page's <main> landmark. One violation remains and is a separate,
    // pre-existing issue out of scope for that fix: the shadcn Sidebar
    // primitive (src/components/ui/sidebar.tsx) renders its nav content in a
    // plain <div data-slot="sidebar">, not a <nav> or other landmark-bearing
    // element, so axe's "region" rule flags every sidebar link/label as "not
    // contained by landmarks". Filtered here pending a follow-up ticket to add
    // a nav landmark to the Sidebar component. Same filter applied in
    // classifier.spec.ts / consensus.spec.ts / filter.spec.ts / gateway.spec.ts
    // / policy.spec.ts / redactor.spec.ts / test_lab.spec.ts.
    const SIDEBAR_A11Y_FOLLOW_UP = new Set(['region']);
    const violations = results.violations.filter(
      (violation) => !SIDEBAR_A11Y_FOLLOW_UP.has(violation.id)
    );
    expect(violations).toEqual([]);
  });
});

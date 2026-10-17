import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers the audit-mode gaps: every topic the activity
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

  test('an expanded blocked pact.decisions row shows controls, stages, per-layer timings and the rule pack', async ({
    page,
  }) => {
    await page.getByTestId('audit-topic-select').selectOption('pact.decisions');

    const blockedRow = page
      .getByTestId('audit-row')
      .filter({ has: page.getByTestId('audit-decision-stage-strip') })
      .first();
    await expect(blockedRow).toBeVisible();

    await expect(
      blockedRow.getByTestId('audit-decision-stage-strip')
    ).toContainText(/\d+ ms/);

    await blockedRow.getByTestId('audit-row-toggle').click();

    await expect(
      blockedRow.getByTestId('audit-decision-controls')
    ).toContainText('OWASP LLM0');
    await expect(blockedRow.getByTestId('audit-decision-stages')).toContainText(
      'policy'
    );
    await expect(blockedRow.getByTestId('audit-decision-pack')).toContainText(
      'pact-core@1.4.0'
    );
  });

  test('the control filter narrows the list and asks for both halves', async ({
    page,
  }) => {
    await page.getByTestId('audit-topic-select').selectOption('pact.decisions');
    const rows = page.getByTestId('audit-row');
    await expect(rows.first()).toBeVisible();
    const unfiltered = await rows.count();

    await page
      .getByTestId('audit-control-framework-select')
      .selectOption('owasp_llm_top10');
    await expect(page.getByTestId('audit-control-filter-hint')).toHaveText(
      'Set both framework and control id'
    );
    // Half-set sends neither param, so the list is unchanged.
    await expect(rows).toHaveCount(unfiltered);

    await page.getByTestId('audit-control-id-input').fill('LLM02');
    await expect(page.getByTestId('audit-control-filter-hint')).toHaveCount(0);
    await expect.poll(async () => rows.count()).toBeLessThan(unfiltered);

    const first = rows.first();
    await first.getByTestId('audit-row-toggle').click();
    await expect(first.getByTestId('audit-decision-controls')).toContainText(
      'OWASP LLM02'
    );
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    // The duplicate <main> landmark (landmark-no-duplicate-main /
    // landmark-unique / landmark-main-is-top-level) was fixed by changing per-page <main>
    // wrappers to <div>, since app/(app)/layout.tsx's SidebarInset already owns
    // the page's <main> landmark. The remaining "region"
    // violation was fixed by giving the shadcn Sidebar primitive
    // (src/components/ui/sidebar.tsx) a <nav aria-label="Primary"> landmark,
    // so every sidebar link/label is now contained by a landmark.
    expect(results.violations).toEqual([]);
  });
});

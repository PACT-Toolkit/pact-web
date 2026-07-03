import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers PACT-324: a live redactor console (verdict, engine, span count,
// expandable span detail) sourced from pact.decisions events, plus an
// ad-hoc test panel that runs pasted text through /v1/check and renders
// the masked preview + span table. createRedactorMockData seeds 30 rows
// cycling through pass_through and redacted scenarios so this spec
// exercises the record list, pagination, and the span-detail toggle.
test.describe('Redactor console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/redactor');
    await expect(page.getByTestId('redactor-workbench')).toBeVisible();

    // Guard against a pre-existing MSW bootstrap race (not introduced by
    // PACT-324): the browser-side mock service worker registers
    // asynchronously (MSWProvider fires init() from a fire-and-forget
    // useEffect), while the redactor-record-card rows checked below are
    // also served by the Node-side MSW integration wired in
    // instrumentation.ts, so they can render before the browser SW has
    // finished activating. A one-shot useSWRMutation call -- the ad-hoc
    // test panel's "Run test" button -- fired in that window slips past
    // the SW, hits the real (absent) gateway proxy, and surfaces a
    // client-visible error instead of the mocked response. Poll a
    // throwaway /v1/check call until it comes back mocked (200) so every
    // test below only interacts once the browser SW is actually ready --
    // this mirrors real usage, since no human clicks within milliseconds
    // of page load. Flagged as a follow-up to restore MSWProvider's
    // ready-gate (its waitUntilReady option is a deprecated no-op in the
    // installed msw version); not fixed here since it is shared
    // app-wide bootstrap code, not part of the redactor console.
    await expect(async () => {
      const status = await page.evaluate(async () => {
        const res = await fetch('/api/pact/gateway/v1/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: 'msw-readiness-probe',
            kind: 'output',
          }),
        });

        return res.status;
      });
      expect(status).toBe(200);
    }).toPass({ timeout: 10_000 });

    // Wait for the first seeded record, not just the container -- the
    // container renders before hydration finishes and before the SWR fetch
    // resolves, so interacting immediately after it appears would race
    // React's event handlers attaching.
    await expect(
      page.getByTestId('redactor-record-card').first()
    ).toBeVisible();
  });

  test('renders seeded redactor records with verdict, engine, and span count', async ({
    page,
  }) => {
    const cards = page.getByTestId('redactor-record-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toContainText(/pass_through|redacted/);
    await expect(cards.first()).toContainText('gateway-v1');
    await expect(cards.first()).toContainText(/\d+ spans?/);

    const redactedCount = page.getByTestId('redactor-redacted-count');
    await expect(redactedCount).toBeVisible();
    await expect(redactedCount).toContainText('of');
  });

  test('span detail toggle reveals entity type and offsets for a redacted row', async ({
    page,
  }) => {
    const redactedCard = page
      .getByTestId('redactor-record-card')
      .filter({ hasText: 'redacted' })
      .first();
    await expect(redactedCard).toBeVisible();

    await redactedCard.getByTestId('redactor-span-detail-toggle').click();

    const detail = redactedCard.getByTestId('redactor-span-detail-pane');
    await expect(detail).toBeVisible();
    await expect(detail.getByTestId('redactor-span-list')).toContainText(
      /EMAIL|PHONE|SSN|API_KEY/
    );
  });

  test('pagination moves to a second page of records', async ({ page }) => {
    const pageInfo = page.getByTestId('redactor-page-info');
    await expect(pageInfo).toContainText('1–25 of');

    const nextButton = page.getByTestId('redactor-page-next');
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    await expect(pageInfo).toContainText('26–');

    const prevButton = page.getByTestId('redactor-page-prev');
    await expect(prevButton).toBeEnabled();
    await prevButton.click();

    await expect(pageInfo).toContainText('1–25 of');
  });

  test('ad-hoc test panel runs text through /v1/check and renders masked output plus spans', async ({
    page,
  }) => {
    await page
      .getByTestId('redactor-test-input')
      .fill('Email me at jane@example.com to follow up.');
    await page.getByTestId('redactor-test-run').click();

    const resultPane = page.getByTestId('redactor-test-result');
    await expect(resultPane).toBeVisible();
    await expect(resultPane).toContainText('redacted');

    const maskedOutput = page.getByTestId('redactor-test-masked-output');
    await expect(maskedOutput).toContainText('[REDACTED:EMAIL]');
    await expect(maskedOutput).not.toContainText('jane@example.com');

    await expect(resultPane.getByTestId('redactor-span-list')).toContainText(
      'EMAIL'
    );
  });

  test('ad-hoc test panel reports pass_through with no spans for clean text', async ({
    page,
  }) => {
    await page
      .getByTestId('redactor-test-input')
      .fill('Summarise the quarterly earnings report.');
    await page.getByTestId('redactor-test-run').click();

    const resultPane = page.getByTestId('redactor-test-result');
    await expect(resultPane).toBeVisible();
    await expect(resultPane).toContainText('pass_through');
    await expect(resultPane).toContainText('0 spans');
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    // These are pre-existing app-shell landmark issues, not introduced by
    // PACT-324: every app/(app)/*/page.tsx (including audit and consensus)
    // wraps its content in its own <main>, while the shared
    // app/(app)/layout.tsx's SidebarInset already renders an outer
    // <main data-slot="sidebar-inset">, producing a nested/duplicate-landmark
    // violation plus "content not contained by landmarks" hits on the
    // sidebar nav. Already filtered the same way in consensus.spec.ts;
    // remove this filter once the shell is fixed.
    const SHELL_A11Y_FOLLOW_UP = new Set([
      'landmark-no-duplicate-main',
      'landmark-unique',
      'landmark-main-is-top-level',
      'region',
    ]);
    const violations = results.violations.filter(
      (violation) => !SHELL_A11Y_FOLLOW_UP.has(violation.id)
    );
    expect(violations).toEqual([]);
  });
});

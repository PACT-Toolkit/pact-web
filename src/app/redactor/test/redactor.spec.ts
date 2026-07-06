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
    expect(results.violations).toEqual([]);
  });
});

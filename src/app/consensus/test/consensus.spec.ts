import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers the consensus-mode gaps closed in PACT-369: the console previously
// had no seeded consensus-bearing decisions at all (empty state only) and
// no pagination once it did. createConsensusMockData seeds 30 rows cycling
// through every consensus_flags.ts scenario (SPLIT / NO QUORUM / FAIL-OPEN
// / LOW CONFIDENCE / clean), so this spec exercises votes, quorum, request
// latency, the flagged-only filter, real pagination, and the new
// raw-payload toggle.
test.describe('Consensus console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/consensus');
    await expect(page.getByTestId('consensus-workbench')).toBeVisible();
    // Wait for the first seeded record, not just the container -- the
    // container renders before hydration finishes and before the SWR fetch
    // resolves, so interacting immediately after it appears would race
    // React's event handlers attaching.
    await expect(
      page.getByTestId('consensus-record-card').first()
    ).toBeVisible();
  });

  test('renders seeded consensus records with votes, quorum, and latency', async ({
    page,
  }) => {
    const firstCard = page.getByTestId('consensus-record-card').first();
    await expect(firstCard).toBeVisible();
    await expect(firstCard).toContainText(/\d+% confidence/);
    await expect(firstCard).toContainText(/ms request latency/);
    await expect(firstCard).toContainText('backend');
  });

  test('flagged-only toggle narrows to SPLIT / NO QUORUM / FAIL-OPEN / LOW CONFIDENCE rows', async ({
    page,
  }) => {
    const flaggedCount = page.getByTestId('consensus-flagged-count');
    await expect(flaggedCount).toBeVisible();
    const beforeText = await flaggedCount.textContent();

    await page.getByTestId('consensus-flagged-only-toggle').click();

    const cards = page.getByTestId('consensus-record-card');
    await expect(cards.first()).toBeVisible();

    const badgeTexts = await cards.allTextContents();
    for (const text of badgeTexts) {
      expect(
        /SPLIT|NO QUORUM|FAIL-OPEN|LOW CONFIDENCE/.test(text)
      ).toBeTruthy();
    }

    expect(beforeText).toBeTruthy();
  });

  test('pagination moves to a second page of records', async ({ page }) => {
    const pageInfo = page.getByTestId('consensus-page-info');
    await expect(pageInfo).toContainText('1–25 of');

    const nextButton = page.getByTestId('consensus-page-next');
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    await expect(pageInfo).toContainText('26–');

    const prevButton = page.getByTestId('consensus-page-prev');
    await expect(prevButton).toBeEnabled();
    await prevButton.click();

    await expect(pageInfo).toContainText('1–25 of');
  });

  test('raw payload toggle reveals the underlying JSON for a record', async ({
    page,
  }) => {
    const firstCard = page.getByTestId('consensus-record-card').first();
    await firstCard.getByTestId('consensus-raw-payload-toggle').click();

    await expect(
      firstCard.getByTestId('consensus-raw-payload-pane')
    ).toContainText('"consensus"');
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    expect(results.violations).toEqual([]);
  });
});

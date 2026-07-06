import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers PACT-322: a live classifier console (label, confidence score,
// engine, and whether consensus arbitrated the request) sourced from
// pact.decisions events. createClassifierMockData seeds 30 rows cycling
// through benign/prompt_injection/jailbreak/sensitive/unknown scenarios,
// none of them consensus-arbitrated on their own; createConsensusMockData's
// 30 rows also carry a classifier sub-object alongside their consensus
// sub-object, so this spec's "arbitrated" assertions exercise those shared
// rows rather than a classifier-only fixture.
//
// Part 2 (the "ad-hoc test panel" tests below) adds the FP/FN label
// action: pact.decisions events never carry raw request content (only a
// content.sha256/bytes hash), so labeling historical console rows stays
// out of scope by design (see classifier_label.ts and the PR description).
// The ad-hoc test panel sidesteps the gap entirely -- the operator types
// the content, so it is in-hand for the POST /v1/classifier/label call the
// label buttons trigger.
test.describe('Classifier console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/classifier');
    await expect(page.getByTestId('classifier-workbench')).toBeVisible();

    // Wait for the first seeded record, not just the container -- the
    // container renders before hydration finishes and before the SWR fetch
    // resolves, so interacting immediately after it appears would race
    // React's event handlers attaching.
    await expect(
      page.getByTestId('classifier-record-card').first()
    ).toBeVisible();
  });

  test('renders seeded classifier records with label, score, and engine', async ({
    page,
  }) => {
    const cards = page.getByTestId('classifier-record-card');
    await expect(cards.first()).toBeVisible();
    await expect(cards.first()).toContainText(
      /benign|prompt_injection|jailbreak|sensitive|unknown/
    );
    await expect(cards.first()).toContainText(/\d+% score/);

    const arbitratedCount = page.getByTestId('classifier-arbitrated-count');
    await expect(arbitratedCount).toBeVisible();
    await expect(arbitratedCount).toContainText('arbitrated by consensus');
  });

  test('flags a consensus-arbitrated row', async ({ page }) => {
    const arbitratedCard = page
      .getByTestId('classifier-record-card')
      .filter({ hasText: 'CONSENSUS ARBITRATED' })
      .first();
    await expect(arbitratedCard).toBeVisible();
  });

  test('pagination moves to a second page of records', async ({ page }) => {
    const pageInfo = page.getByTestId('classifier-page-info');
    await expect(pageInfo).toContainText('1–25 of');

    const nextButton = page.getByTestId('classifier-page-next');
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    await expect(pageInfo).toContainText('26–');

    const prevButton = page.getByTestId('classifier-page-prev');
    await expect(prevButton).toBeEnabled();
    await prevButton.click();

    await expect(pageInfo).toContainText('1–25 of');
  });

  test('ad-hoc test panel flags a hostile verdict and marks it false positive', async ({
    page,
  }) => {
    // Two HOSTILE_WORDS hits (exploit, weapon) trip runClassifier's
    // deterministic block/"sensitive" branch (src/app/test_lab/mock/data/
    // test_lab.ts); none of the filter-stage regexes match, so the filter
    // stage allows and the classifier stage actually runs.
    await page
      .getByTestId('classifier-test-input')
      .fill(
        'The article explains how someone could exploit a weapon design flaw.'
      );
    await page.getByTestId('classifier-test-run').click();

    const resultPane = page.getByTestId('classifier-test-result');
    await expect(resultPane).toBeVisible();
    await expect(resultPane).toContainText('sensitive');

    const markFalsePositive = page.getByTestId('classifier-test-mark-fp');
    const markFalseNegative = page.getByTestId('classifier-test-mark-fn');
    await expect(markFalsePositive).toBeEnabled();
    await expect(markFalseNegative).toBeDisabled();

    await markFalsePositive.click();

    const confirmation = page.getByTestId('classifier-test-label-confirm');
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('labeled false positive');
  });

  test('ad-hoc test panel reports a benign verdict and marks it false negative', async ({
    page,
  }) => {
    await page
      .getByTestId('classifier-test-input')
      .fill('Please write a cheerful welcome message for new employees.');
    await page.getByTestId('classifier-test-run').click();

    const resultPane = page.getByTestId('classifier-test-result');
    await expect(resultPane).toBeVisible();
    await expect(resultPane).toContainText('benign');

    const markFalsePositive = page.getByTestId('classifier-test-mark-fp');
    const markFalseNegative = page.getByTestId('classifier-test-mark-fn');
    await expect(markFalseNegative).toBeEnabled();
    await expect(markFalsePositive).toBeDisabled();

    await markFalseNegative.click();

    const confirmation = page.getByTestId('classifier-test-label-confirm');
    await expect(confirmation).toBeVisible();
    await expect(confirmation).toContainText('labeled false negative');
  });

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    // Pre-existing "region" violation, out of scope for PACT-427 (which fixed
    // the duplicate <main> landmark). Same filter/rationale as audit.spec.ts:
    // the shadcn Sidebar primitive lacks a nav landmark. Remove once that's
    // fixed in a follow-up ticket.
    const SIDEBAR_A11Y_FOLLOW_UP = new Set(['region']);
    const violations = results.violations.filter(
      (violation) => !SIDEBAR_A11Y_FOLLOW_UP.has(violation.id)
    );
    expect(violations).toEqual([]);
  });
});

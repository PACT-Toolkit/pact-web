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
// The label-action sub-item (mark false-positive/false-negative) is not
// built in this PR: pact-gateway's POST /v1/classifier/label handler
// hard-requires a non-empty `content` field at runtime, and pact.decisions
// payloads never carry raw request content (only a content.sha256/bytes
// hash) -- see classifier_record.ts and the PR description for the full
// gap writeup. This spec therefore only exercises the verdict stream and
// pagination.
test.describe('Classifier console', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/classifier');
    await expect(page.getByTestId('classifier-workbench')).toBeVisible();

    // Guard against a pre-existing MSW bootstrap race (not introduced by
    // PACT-322): the browser-side mock service worker registers
    // asynchronously (MSWProvider fires init() from a fire-and-forget
    // useEffect), while the classifier-record-card rows checked below are
    // also served by the Node-side MSW integration wired in
    // instrumentation.ts, so they can render before the browser SW has
    // finished activating. Poll a throwaway /v1/check call until it comes
    // back mocked (200) so every test below only interacts once the browser
    // SW is actually ready -- mirrors the same guard in redactor.spec.ts /
    // consensus.spec.ts (shared app-wide bootstrap code, not part of this
    // console).
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

  test('has no accessibility violations', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    // These are pre-existing app-shell landmark issues, not introduced by
    // PACT-322: every app/(app)/*/page.tsx (including audit, consensus, and
    // redactor) wraps its content in its own <main>, while the shared
    // app/(app)/layout.tsx's SidebarInset already renders an outer
    // <main data-slot="sidebar-inset">, producing a nested/duplicate-landmark
    // violation plus "content not contained by landmarks" hits on the
    // sidebar nav. Already filtered the same way in redactor.spec.ts /
    // consensus.spec.ts; remove this filter once the shell is fixed.
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

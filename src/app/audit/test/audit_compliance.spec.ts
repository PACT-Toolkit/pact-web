import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers /audit/compliance: per-control totals over the mock decisions,
// the sidebar entry, the empty state, the report download and the
// audit:stats permission gate (the 'auditor' persona is answered 403).
test.describe('Audit compliance view', () => {
  test.describe('operator persona', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/audit/compliance');
      await expect(page.getByTestId('audit-compliance-view')).toBeVisible();
      await expect(
        page.getByTestId('audit-compliance-stats-table')
      ).toBeVisible();
    });

    test('lights the Compliance sidebar item and not Activity', async ({
      page,
    }) => {
      const sidebar = page.locator('[data-sidebar="sidebar"]').first();
      await expect(
        sidebar.getByRole('link', { name: 'Compliance' })
      ).toHaveAttribute('data-active', 'true');
      await expect(
        sidebar.getByRole('link', { name: 'Activity' })
      ).toHaveAttribute('data-active', 'false');
    });

    test('shows seeded control rows and the unmapped row', async ({ page }) => {
      expect(
        await page.getByTestId('audit-compliance-stat-row').count()
      ).toBeGreaterThan(0);
      await expect(
        page.getByTestId('audit-compliance-unmapped-row')
      ).toBeVisible();
    });

    test('a far-past window shows the empty state', async ({ page }) => {
      await page.getByTestId('audit-compliance-since').fill('2001-01-01T00:00');
      await page.getByTestId('audit-compliance-until').fill('2001-01-02T00:00');

      await expect(page.getByTestId('audit-compliance-empty')).toHaveText(
        'No decisions in this window'
      );
      await expect(
        page.getByTestId('audit-compliance-stats-table')
      ).toHaveCount(0);

      await page.getByTestId('audit-compliance-reset').click();
      await expect(
        page.getByTestId('audit-compliance-stats-table')
      ).toBeVisible();
    });

    test('downloads a parseable compliance report', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download');
      await page.getByTestId('audit-compliance-download').click();
      const download = await downloadPromise;

      expect(download.suggestedFilename()).toMatch(
        /^pact-compliance-report-\d+-\d+\.json$/
      );

      const path = await download.path();
      const { readFile } = await import('node:fs/promises');
      const report = JSON.parse(await readFile(path, 'utf8'));

      expect(Object.keys(report).sort()).toEqual([
        'entries',
        'generatedAtUnix',
        'sinceUnix',
        'untilUnix',
      ]);
      expect(report.generatedAtUnix).toBeGreaterThan(report.sinceUnix);
      expect(report.entries.length).toBeGreaterThan(0);
      expect(Object.keys(report.entries[0]).sort()).toEqual([
        'controls',
        'createdAtUnix',
        'decision',
        'engine',
        'eventUuid',
        'requestId',
      ]);
    });

    test('has no accessibility violations', async ({ page }) => {
      const results = await makeAxeBuilder(page).analyze();
      expect(results.violations).toEqual([]);
    });
  });

  test('non-operator persona sees the permission empty state', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      { name: 'mock-user-type', value: 'auditor', url: baseURL ?? '' },
    ]);
    await page.goto('/audit/compliance');

    await expect(page.getByTestId('audit-compliance-forbidden')).toHaveText(
      'Compliance aggregates need the audit:stats permission'
    );
    await expect(page.getByTestId('audit-compliance-download')).toHaveCount(0);

    const results = await makeAxeBuilder(page).analyze();
    expect(results.violations).toEqual([]);
  });
});

import { expect, test } from '@playwright/test';

import { makeAxeBuilder } from '../../../../playwright/axe-fixture';

// Covers PACT-927: the trend chart's two lines never painted (chart.tsx
// wrapped the --chart-1/--chart-2 custom properties in hsl(), but they held
// greyscale oklch() values, so the emitted --color-detection_rate /
// --color-fp_rate custom properties resolved to nothing). This spec proves
// both <path> elements recharts draws for the lines actually carry a
// non-empty `d` attribute - a painted line, not just a mounted chart.
test.describe('Benchmark trend chart', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/benchmark');
    await expect(page.getByTestId('benchmark-workbench')).toBeVisible();
    await expect(page.getByTestId('benchmark-trend-chart')).toBeVisible();
  });

  test('paints both the detection rate and FP rate lines', async ({ page }) => {
    const lines = page
      .getByTestId('benchmark-trend-chart')
      .locator('.recharts-line-curve');

    await expect(lines).toHaveCount(2);

    for (const line of await lines.all()) {
      const d = await line.getAttribute('d');
      expect(d).not.toBeNull();
      expect(d?.length).toBeGreaterThan(0);
    }
  });

  test('passes an accessibility check', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    expect(results.violations).toEqual([]);
  });
});

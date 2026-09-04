import { expect, test } from '@playwright/test';

import { MOCK_CORPUS_DATASETS } from '@/src/app/benchmark/mock/data/benchmark';

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

// Covers PACT-928: latency, corpus composition, and comparison-delta charts
// added alongside the fixed trend chart.
test.describe('Benchmark latency, corpus composition, and comparison charts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/benchmark');
    await expect(page.getByTestId('benchmark-workbench')).toBeVisible();
  });

  test('paints both the p50 and p99 latency lines', async ({ page }) => {
    const chart = page.getByTestId('benchmark-latency-chart');
    await expect(chart).toBeVisible();

    const lines = chart.locator('.recharts-line-curve');
    await expect(lines).toHaveCount(2);

    for (const line of await lines.all()) {
      const d = await line.getAttribute('d');
      expect(d).not.toBeNull();
      expect(d?.length).toBeGreaterThan(0);
    }
  });

  test('renders one composition bar row per mock corpus dataset', async ({
    page,
  }) => {
    const rows = page.getByTestId('benchmark-corpus-composition-row');
    await expect(rows).toHaveCount(MOCK_CORPUS_DATASETS.length);

    const bars = page.getByTestId('benchmark-corpus-composition-bar');
    for (const bar of await bars.all()) {
      await expect(bar).toHaveAttribute(
        'aria-label',
        /% block, \d+(\.\d+)?% allow/
      );
    }
  });

  test('shows a signed delta bar per comparison metric', async ({ page }) => {
    const bars = page.getByTestId('benchmark-comparison-delta-bar');
    await expect(bars).toHaveCount(4);

    for (const bar of await bars.all()) {
      await expect(bar).toHaveAttribute('aria-label', /delta:/);
    }
  });

  test('the shared range toggle filters both the trend and latency charts', async ({
    page,
  }) => {
    const toggle = page.getByTestId('benchmark-trend-range-toggle');
    await expect(toggle).toBeVisible();

    await toggle.getByRole('button', { name: '7d', exact: true }).click();
    // Longer timeout than the default 5s: this click re-renders both the
    // trend and latency charts (two Recharts LineCharts) in the same commit,
    // which can outrun the default window under CPU load.
    await expect(
      toggle.getByRole('button', { name: '7d', exact: true })
    ).toHaveAttribute('aria-pressed', 'true', { timeout: 15000 });

    // Both charts stay mounted and keep painting after the range narrows -
    // proves the lifted state actually reaches both consumers, not just one.
    await expect(
      page.getByTestId('benchmark-trend-chart').locator('.recharts-line-curve')
    ).toHaveCount(2);
    await expect(
      page
        .getByTestId('benchmark-latency-chart')
        .locator('.recharts-line-curve')
    ).toHaveCount(2);
  });

  test('passes an accessibility check', async ({ page }) => {
    const results = await makeAxeBuilder(page).analyze();
    expect(results.violations).toEqual([]);
  });
});

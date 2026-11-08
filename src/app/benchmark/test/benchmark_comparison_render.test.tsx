import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BenchmarkComparison } from '@/src/app/benchmark/ui/BenchmarkComparison';
import type * as ChartModule from '@/src/components/ui/chart';

// These tests cover the run pickers and the unscored flag, not the charts.
// Recharts renders every axis, tick and series synchronously in jsdom, which
// takes about half of each render and made the tests exceed the default
// timeout on a loaded machine. The container renders nothing inside.
vi.mock('@/src/components/ui/chart', async (importOriginal) => ({
  ...(await importOriginal<typeof ChartModule>()),
  ChartContainer: () => <div data-slot="chart" />,
}));

const renderComparison = () =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkComparison />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('BenchmarkComparison run pickers', () => {
  it('names each picker by its label and shows the selected run', async () => {
    renderComparison();
    const candidate = await screen.findByRole('combobox', {
      name: 'Candidate',
    });
    const baseline = screen.getByRole('combobox', { name: 'Baseline' });

    // Defaults: newest run is the candidate, the one before it the baseline.
    expect(candidate).toHaveTextContent('deberta');
    expect(baseline).toHaveTextContent('stub');
  });
});

describe('BenchmarkComparison unscored flag', () => {
  it('shows no unscored flag for the default pair', async () => {
    renderComparison();
    await waitFor(() =>
      expect(screen.getByTestId('benchmark-compare-candidate')).toBeVisible()
    );

    expect(
      screen.queryByTestId('benchmark-comparison-not-quotable')
    ).not.toBeInTheDocument();
  });

  it('flags a candidate over the unscored limit as not quotable, naming its share', async () => {
    renderComparison();
    await waitFor(() =>
      expect(screen.getByTestId('benchmark-compare-candidate')).toBeVisible()
    );

    // The seeded run-11 has 300 of its 2,000 rows unscored (15.0%).
    fireEvent.click(screen.getByTestId('benchmark-compare-candidate'));
    fireEvent.click(await screen.findByRole('option', { name: /2000 rows/ }));

    const flag = await screen.findByTestId('benchmark-comparison-not-quotable');
    expect(flag).toHaveTextContent('Candidate: 15.0% of rows unscored');
    expect(flag).toHaveTextContent('not quotable');
  });
});

describe('BenchmarkComparison degraded run', () => {
  it('marks the degraded run in the picker and flags it as not quotable', async () => {
    renderComparison();
    await waitFor(() =>
      expect(screen.getByTestId('benchmark-compare-candidate')).toBeVisible()
    );

    // The seeded run-12 is degraded (30 of its 120 rows lost).
    fireEvent.click(screen.getByTestId('benchmark-compare-candidate'));
    const option = await screen.findByRole('option', {
      name: /120 rows.*degraded/,
    });
    fireEvent.click(option);

    const flag = await screen.findByTestId('benchmark-comparison-not-quotable');
    expect(flag).toHaveTextContent('Candidate: run degraded');
    expect(flag).toHaveTextContent('not quotable');
  });
});

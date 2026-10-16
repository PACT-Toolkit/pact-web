import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BenchmarkComparison } from '@/src/app/benchmark/ui/BenchmarkComparison';

const renderComparison = () =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkComparison />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('BenchmarkComparison unscored flag', () => {
  it('shows no unscored flag for the default pair', async () => {
    renderComparison();
    await waitFor(() =>
      expect(screen.getByTestId('benchmark-compare-candidate')).toBeVisible()
    );

    expect(
      screen.queryByTestId('benchmark-comparison-unscored')
    ).not.toBeInTheDocument();
  });

  it('flags a candidate over the unscored limit as not quotable, naming its share', async () => {
    renderComparison();
    await waitFor(() =>
      expect(screen.getByTestId('benchmark-compare-candidate')).toBeVisible()
    );

    // The seeded run-11 has 300 of its 2,000 rows unscored (15.0%).
    fireEvent.change(screen.getByTestId('benchmark-compare-candidate'), {
      target: { value: 'run-11' },
    });

    const flag = await screen.findByTestId('benchmark-comparison-unscored');
    expect(flag).toHaveTextContent('Candidate: 15.0% of rows unscored');
    expect(flag).toHaveTextContent('not quotable');
  });
});

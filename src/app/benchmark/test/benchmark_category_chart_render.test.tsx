import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { BenchmarkCategoryChart } from '@/src/app/benchmark/ui/BenchmarkCategoryChart';

function makeRun(overrides: Partial<BenchmarkRun>): BenchmarkRun {
  return {
    id: 'run-1',
    gateway_version: 'v1.0.0',
    engine: 'deberta',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.95,
    fp_rate: 0.05,
    p50_latency: 20,
    p99_latency: 100,
    row_count: 200,
    ran_at: 1_700_000_000,
    ...overrides,
  };
}

// PACT-932 fix (coordinator finding): "Select a run to inspect." used to
// render whenever `run` was undefined, which is also true while
// BenchmarkComparison's runs are still loading and when there are zero runs
// -- neither state has a picker on screen, so the sentence told the user to
// do something impossible. `isLoading` disambiguates those two undefined-run
// cases; the "no breakdown for this run" branch (a real run with no
// per_category data) is unaffected and still renders.
describe('BenchmarkCategoryChart empty states', () => {
  it('shows a loading placeholder while runs are still being fetched', () => {
    render(<BenchmarkCategoryChart run={undefined} isLoading={true} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(
      screen.queryByText('Select a run to inspect.')
    ).not.toBeInTheDocument();
  });

  it('shows "No runs recorded yet." once loading settles with no run', () => {
    render(<BenchmarkCategoryChart run={undefined} isLoading={false} />);

    expect(screen.getByText('No runs recorded yet.')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows the no-breakdown copy for a run with no per_category data', () => {
    render(
      <BenchmarkCategoryChart
        run={makeRun({ per_category: undefined })}
        isLoading={false}
      />
    );

    expect(
      screen.getByText('No category breakdown recorded for this run.')
    ).toBeInTheDocument();
  });
});

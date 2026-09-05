import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { BenchmarkStageLatencyChart } from '@/src/app/benchmark/ui/BenchmarkStageLatencyChart';

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

// PACT-932 fix (coordinator finding): same "Select a run to inspect." bug as
// BenchmarkCategoryChart (see that test file's docblock) -- `isLoading` now
// disambiguates "runs still fetching" from "fetch settled, zero runs."
describe('BenchmarkStageLatencyChart empty states', () => {
  it('shows a loading placeholder while runs are still being fetched', () => {
    render(<BenchmarkStageLatencyChart run={undefined} isLoading={true} />);

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(
      screen.queryByText('Select a run to inspect.')
    ).not.toBeInTheDocument();
  });

  it('shows "No runs recorded yet." once loading settles with no run', () => {
    render(<BenchmarkStageLatencyChart run={undefined} isLoading={false} />);

    expect(screen.getByText('No runs recorded yet.')).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).not.toBeInTheDocument();
  });

  it('shows the no-breakdown copy for a run with no per_layer data', () => {
    render(
      <BenchmarkStageLatencyChart
        run={makeRun({ per_layer: undefined })}
        isLoading={false}
      />
    );

    expect(
      screen.getByText('No per-stage breakdown recorded for this run.')
    ).toBeInTheDocument();
  });
});

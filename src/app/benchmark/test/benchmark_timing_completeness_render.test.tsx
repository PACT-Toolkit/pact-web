import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { BenchmarkTimingCompleteness } from '@/src/app/benchmark/ui/BenchmarkTimingCompleteness';

function makeRun(
  timing_completeness: BenchmarkRun['timing_completeness']
): BenchmarkRun {
  return {
    id: 'run-1',
    gateway_version: 'v1.0.0',
    engine: 'deberta',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.95,
    fp_rate: 0.05,
    p50_latency: 20,
    p99_latency: 100,
    row_count: 20,
    degraded: false,
    ran_at: 1_700_000_000,
    timing_completeness,
  };
}

describe('BenchmarkTimingCompleteness', () => {
  it('shows "not recorded" and no table for a run without the summary', () => {
    render(<BenchmarkTimingCompleteness run={makeRun(undefined)} />);

    expect(screen.getByText(/not recorded/i)).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('timing-stages-line')).not.toBeInTheDocument();
  });

  it('renders nothing without a run', () => {
    render(<BenchmarkTimingCompleteness run={undefined} />);

    expect(
      screen.queryByTestId('benchmark-timing-completeness')
    ).not.toBeInTheDocument();
  });

  it('flags the layer and the stages line that have missing counts', () => {
    render(
      <BenchmarkTimingCompleteness
        run={makeRun({
          rows_total: 20,
          rows_missing_stages: 4,
          layers: [
            {
              layer: 'classifier',
              rows_with_signal: 20,
              rows_missing_duration: 0,
            },
            {
              layer: 'redactor',
              rows_with_signal: 20,
              rows_missing_duration: 2,
            },
            {
              layer: 'consensus',
              rows_with_signal: 0,
              rows_missing_duration: 0,
            },
          ],
        })}
      />
    );

    const redactor = screen.getByTestId('timing-layer-redactor');
    expect(redactor).toHaveAttribute('data-state', 'missing');
    expect(within(redactor).getByText('2')).toHaveClass('text-warning');
    expect(screen.getByTestId('timing-layer-classifier')).toHaveAttribute(
      'data-state',
      'pass'
    );
    // A layer with no signal reads as 0, not as a failure.
    expect(screen.getByTestId('timing-layer-consensus')).toHaveAttribute(
      'data-state',
      'pass'
    );
    const stages = screen.getByTestId('timing-stages-line');
    expect(stages).toHaveAttribute('data-state', 'missing');
    expect(stages).toHaveTextContent('Rows missing stages: 4 of 20');
  });

  it('reads all-zero counts as a pass without the warning colour', () => {
    render(
      <BenchmarkTimingCompleteness
        run={makeRun({
          rows_total: 20,
          rows_missing_stages: 0,
          layers: [
            {
              layer: 'classifier',
              rows_with_signal: 20,
              rows_missing_duration: 0,
            },
          ],
        })}
      />
    );

    const stages = screen.getByTestId('timing-stages-line');
    expect(stages).toHaveAttribute('data-state', 'pass');
    expect(stages).not.toHaveClass('text-warning');
  });
});

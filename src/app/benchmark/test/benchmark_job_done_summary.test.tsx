import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { type JobResult } from '@/src/app/benchmark/domain/benchmark_job';
import { BenchmarkJobDoneSummary } from '@/src/app/benchmark/ui/BenchmarkJobDoneSummary';

const makeResult = (overrides: Partial<JobResult> = {}): JobResult => ({
  detection_rate: 0.93,
  fp_rate: 0.04,
  p50_latency_ms: 12.3,
  p99_latency_ms: 120.1,
  rows: [],
  total_rows: 200,
  run_id: 'run-7',
  counts: {
    attacks: 100,
    benign: 100,
    errors: 2,
    false_positives: 4,
    true_positives: 93,
    throttled: 3,
    unscored: 5,
  },
  ...overrides,
});

const renderSummary = (result: JobResult) =>
  render((<BenchmarkJobDoneSummary result={result} />) as ReactNode);

describe('BenchmarkJobDoneSummary', () => {
  it('shows the headline rates and latencies', () => {
    renderSummary(makeResult());

    expect(
      screen.getByTestId('benchmark-job-stat-detection_rate')
    ).toHaveTextContent('Detection rate93.0%');
    expect(screen.getByTestId('benchmark-job-stat-fp_rate')).toHaveTextContent(
      'False-positive rate4.0%'
    );
    expect(
      screen.getByTestId('benchmark-job-stat-p50_latency')
    ).toHaveTextContent('p50 latency12.3 ms');
    expect(
      screen.getByTestId('benchmark-job-stat-p99_latency')
    ).toHaveTextContent('p99 latency120.1 ms');
  });

  it('shows every confusion count derived from the job counts', () => {
    renderSummary(makeResult());

    expect(screen.getByTestId('benchmark-confusion-tp')).toHaveTextContent(
      '93'
    );
    // False negatives = attacks - true positives = 100 - 93.
    expect(screen.getByTestId('benchmark-confusion-fn')).toHaveTextContent('7');
    expect(screen.getByTestId('benchmark-confusion-fp')).toHaveTextContent('4');
    // True negatives = benign - false positives = 100 - 4.
    expect(screen.getByTestId('benchmark-confusion-tn')).toHaveTextContent(
      '96'
    );
    expect(screen.getByTestId('benchmark-confusion-errors')).toHaveTextContent(
      '2'
    );
    expect(
      screen.getByTestId('benchmark-confusion-throttled')
    ).toHaveTextContent('3');
    expect(
      screen.getByTestId('benchmark-confusion-unscored')
    ).toHaveTextContent('5');
  });

  it('links to the rows of the persisted run', () => {
    renderSummary(makeResult());

    expect(screen.getByRole('link', { name: 'View rows' })).toHaveAttribute(
      'href',
      '/benchmark/runs/run-7'
    );
  });

  it('renders zeros for a run with no rows and no rows link without a run id', () => {
    renderSummary(
      makeResult({
        detection_rate: 0,
        fp_rate: 0,
        p50_latency_ms: 0,
        p99_latency_ms: 0,
        total_rows: 0,
        run_id: undefined,
        counts: {
          attacks: 0,
          benign: 0,
          errors: 0,
          false_positives: 0,
          true_positives: 0,
          throttled: 0,
          unscored: 0,
        },
      })
    );

    expect(
      screen.getByTestId('benchmark-job-stat-detection_rate')
    ).toHaveTextContent('0.0%');
    expect(
      screen.getByTestId('benchmark-job-stat-p99_latency')
    ).toHaveTextContent('0.0 ms');
    for (const id of ['tp', 'fn', 'fp', 'tn', 'errors', 'throttled']) {
      expect(screen.getByTestId(`benchmark-confusion-${id}`)).toHaveTextContent(
        '0'
      );
    }
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('keeps the headline stats when the job predates the counts breakdown', () => {
    renderSummary(makeResult({ counts: undefined, run_id: undefined }));

    expect(
      screen.getByTestId('benchmark-job-headline-stats')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('benchmark-confusion-tiles')
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type CategoryBreakdown } from '@/src/app/benchmark/domain/benchmark_breakdown';
import { categoryChartData } from '@/src/app/benchmark/domain/benchmark_category_chart';
import { BenchmarkCategoryTooltipRow } from '@/src/app/benchmark/ui/BenchmarkCategoryTooltipRow';

const pointFor = (overrides: Partial<CategoryBreakdown>) =>
  categoryChartData({
    id: 'run-1',
    gateway_version: 'v1.0.0',
    engine: 'deberta',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.9,
    fp_rate: 0.1,
    p50_latency: 20,
    p99_latency: 100,
    row_count: 30,
    degraded: false,
    ran_at: 1_700_000_000,
    per_category: [
      {
        category: 'mixed-injection',
        entries: 30,
        attacks: 20,
        benign: 10,
        detected: 18,
        fp: 1,
        errors: 0,
        mitigated: 0,
        throttled: 0,
        unscored: 0,
        ...overrides,
      },
    ],
  })[0];

describe('BenchmarkCategoryTooltipRow', () => {
  it('shows the value, the fraction and the 95% interval for a defined rate', () => {
    render(
      <BenchmarkCategoryTooltipRow
        seriesKey="detectionRate"
        point={pointFor({})}
      />
    );

    expect(screen.getByText('Detection rate')).toBeInTheDocument();
    expect(screen.getByText('90.0%')).toBeInTheDocument();
    expect(
      screen.getByText('18 of 20 attack rows · 95% CI 69.9-97.2%')
    ).toBeInTheDocument();
  });

  it('shows n/a and the reason for an undefined rate', () => {
    render(
      <BenchmarkCategoryTooltipRow
        seriesKey="detectionRate"
        point={pointFor({ attacks: 0, detected: 0 })}
      />
    );

    expect(screen.getByText('n/a')).toBeInTheDocument();
    expect(screen.getByText('no attack rows')).toBeInTheDocument();
  });

  it('shows a true 0% as a value with its interval, not as n/a', () => {
    render(
      <BenchmarkCategoryTooltipRow
        seriesKey="fpRate"
        point={pointFor({ fp: 0 })}
      />
    );

    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(screen.queryByText('n/a')).not.toBeInTheDocument();
    expect(
      screen.getByText('0 of 10 benign rows · 95% CI 0-27.8%')
    ).toBeInTheDocument();
  });

  it('shows the counters on the FP row only, so they appear once per tooltip', () => {
    const point = pointFor({
      errors: 2,
      mitigated: 3,
      throttled: 4,
      unscored: 5,
    });
    const { rerender } = render(
      <BenchmarkCategoryTooltipRow seriesKey="detectionRate" point={point} />
    );

    expect(screen.queryByText('Errors: 2')).not.toBeInTheDocument();

    rerender(<BenchmarkCategoryTooltipRow seriesKey="fpRate" point={point} />);

    expect(screen.getByText('Errors: 2')).toBeInTheDocument();
    expect(screen.getByText('Mitigated: 3')).toBeInTheDocument();
    expect(screen.getByText('Throttled: 4')).toBeInTheDocument();
    expect(screen.getByText('Unscored: 5')).toBeInTheDocument();
  });
});

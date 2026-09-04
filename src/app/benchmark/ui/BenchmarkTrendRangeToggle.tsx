'use client';

import {
  TREND_DATE_RANGES,
  type TrendDateRange,
} from '@/src/app/benchmark/domain/benchmark_run';
import { Button } from '@/src/components/ui/button';

interface BenchmarkTrendRangeToggleProps {
  value: TrendDateRange;
  onChange: (value: TrendDateRange) => void;
}

/**
 * Shared date-range control for every chart driven by `useBenchmarkRuns` -
 * rendered once above the detection/FP and latency panels so both read the
 * same range instead of each owning (and potentially disagreeing on) its
 * own filter state.
 */
export const BenchmarkTrendRangeToggle = ({
  value,
  onChange,
}: BenchmarkTrendRangeToggleProps) => (
  <div
    className="flex justify-end gap-1"
    role="group"
    aria-label="Date range"
    data-testid="benchmark-trend-range-toggle"
  >
    {TREND_DATE_RANGES.map(({ label, value: rangeValue }) => (
      <Button
        key={rangeValue}
        size="sm"
        variant={value === rangeValue ? 'secondary' : 'ghost'}
        className="h-7 px-2 text-xs"
        aria-pressed={value === rangeValue}
        onClick={() => onChange(rangeValue)}
      >
        {label}
      </Button>
    ))}
  </div>
);

import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';

/** One plotted point on the detection/FP trend chart. */
export interface TrendChartPoint {
  ran_at: number;
  /** Percent, rounded to one decimal (e.g. 95.3). */
  detection_rate: number;
  /** Percent, rounded to one decimal (e.g. 5.2). */
  fp_rate: number;
  row_count: number;
  corpus_version: string;
  engine: string;
  gateway_version: string;
}

/** A single series' display label and CSS color for a recharts `ChartConfig`. */
interface TrendSeriesEntry {
  label: string;
  color: string;
}

/**
 * Series config for the detection/FP trend chart's two lines. Colors
 * reference the app's categorical `--chart-*` custom properties directly -
 * chart.tsx's `ChartStyle` re-emits `color` verbatim as `--color-<key>`,
 * so wrapping it in `hsl(...)` (the pre-PACT-927 shape) breaks once those
 * properties hold oklch values.
 */
export const TREND_SERIES: Record<
  'detection_rate' | 'fp_rate',
  TrendSeriesEntry
> = {
  detection_rate: { label: 'Detection rate', color: 'var(--chart-1)' },
  fp_rate: { label: 'FP rate', color: 'var(--chart-2)' },
};

/** Round a 0-1 fraction to a percent with one decimal place, e.g. 0.0523 -> 5.2. */
function roundToOneDecimalPercent(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

/**
 * Map benchmark runs into detection/FP trend chart points, sorted ascending
 * by `ran_at` so the chart plots left-to-right chronologically regardless
 * of the order runs arrive in.
 */
export function trendChartData(
  runs: readonly BenchmarkRun[]
): TrendChartPoint[] {
  return [...runs]
    .sort((a, b) => a.ran_at - b.ran_at)
    .map((r) => ({
      ran_at: r.ran_at,
      detection_rate: roundToOneDecimalPercent(r.detection_rate),
      fp_rate: roundToOneDecimalPercent(r.fp_rate),
      row_count: r.row_count,
      corpus_version: r.corpus_version,
      engine: r.engine,
      gateway_version: r.gateway_version,
    }));
}

/**
 * Full date + time label for a trend/latency chart tooltip, e.g.
 * "5 Aug 2026, 14:32".
 */
export function formatRunTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

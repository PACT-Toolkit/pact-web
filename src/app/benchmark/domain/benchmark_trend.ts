import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { roundToOneDecimalPercent } from '@/src/framework/format/round_percent';
import { wilsonIntervalForCounts } from '@/src/framework/stats/wilson_interval';

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
  /**
   * 95% Wilson confidence band for detection_rate, [low, high] in percent
   * (0-100). `undefined` when the run has no `counts` breakdown - recharts
   * renders a gap for that point rather than a misleading band pinned to
   * zero (see `wilsonIntervalForCounts`).
   */
  detection_band?: [number, number];
  /** Same shape as detection_band, for fp_rate. */
  fp_band?: [number, number];
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

/** Convert a `{low, high}` fraction interval to a `[low, high]` percent tuple, rounded to one decimal. */
function bandToPercentTuple(
  interval: { low: number; high: number } | undefined
): [number, number] | undefined {
  if (!interval) return undefined;

  return [
    roundToOneDecimalPercent(interval.low),
    roundToOneDecimalPercent(interval.high),
  ];
}

/**
 * Map benchmark runs into detection/FP trend chart points, sorted ascending
 * by `ran_at` so the chart plots left-to-right chronologically regardless
 * of the order runs arrive in. Confidence bands come from the run's
 * `counts` breakdown (absent on pre-migration runs, which is why the band
 * fields are optional - see `wilsonIntervalForCounts`).
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
      detection_band: bandToPercentTuple(
        wilsonIntervalForCounts(r.counts?.true_positives, r.counts?.attacks)
      ),
      fp_band: bandToPercentTuple(
        wilsonIntervalForCounts(r.counts?.false_positives, r.counts?.benign)
      ),
    }));
}

/** Render a `[low, high]` percent band as "low%-high%" for a tooltip line, or null when absent. */
export function formatConfidenceBand(
  band: [number, number] | undefined
): string | null {
  if (!band) return null;

  return `${band[0]}%-${band[1]}%`;
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

/** One plotted point on the p50/p99 latency chart. */
export interface LatencyChartPoint {
  ran_at: number;
  p50_latency: number;
  p99_latency: number;
  row_count: number;
  corpus_version: string;
  engine: string;
  gateway_version: string;
}

/**
 * Series config for the p50/p99 latency chart's two lines. Colors follow
 * the same direct `--chart-*` reference as `TREND_SERIES` (see its comment)
 * but pick the next two hues in the categorical palette so the latency
 * panel reads as a distinct pair from the detection/FP panel above it.
 */
export const LATENCY_SERIES: Record<
  'p50_latency' | 'p99_latency',
  TrendSeriesEntry
> = {
  p50_latency: { label: 'p50 latency', color: 'var(--chart-3)' },
  p99_latency: { label: 'p99 latency', color: 'var(--chart-4)' },
};

/**
 * Map benchmark runs into p50/p99 latency chart points, sorted ascending by
 * `ran_at` so the chart plots left-to-right chronologically regardless of
 * the order runs arrive in. Latency values are carried through unrounded -
 * unlike the percent rates on the trend chart, a millisecond figure doesn't
 * need rounding for display and `formatMetric` already fixes it to one
 * decimal at render time.
 */
export function latencyChartData(
  runs: readonly BenchmarkRun[]
): LatencyChartPoint[] {
  return [...runs]
    .sort((a, b) => a.ran_at - b.ran_at)
    .map((r) => ({
      ran_at: r.ran_at,
      p50_latency: r.p50_latency,
      p99_latency: r.p99_latency,
      row_count: r.row_count,
      corpus_version: r.corpus_version,
      engine: r.engine,
      gateway_version: r.gateway_version,
    }));
}

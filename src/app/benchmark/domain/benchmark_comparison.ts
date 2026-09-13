import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { abbreviateHash } from '@/src/framework/format/abbreviate_hash';
import {
  formatMetric,
  type MetricFormat,
} from '@/src/framework/format/metric_format';

/** Whether a larger value is better (detection) or worse (FP, latency). */
export type MetricGoal = 'higher-better' | 'lower-better';

/** Direction of a candidate-vs-baseline delta once the metric goal is applied. */
export type DeltaDirection = 'improved' | 'regressed' | 'neutral';

interface MetricDef {
  key: 'detection_rate' | 'fp_rate' | 'p50_latency' | 'p99_latency';
  label: string;
  format: MetricFormat;
  goal: MetricGoal;
}

/** The metrics surfaced in the comparison table, in display order. */
export const COMPARISON_METRICS: readonly MetricDef[] = [
  {
    key: 'detection_rate',
    label: 'Detection rate',
    format: 'percent',
    goal: 'higher-better',
  },
  {
    key: 'fp_rate',
    label: 'False-positive rate',
    format: 'percent',
    goal: 'lower-better',
  },
  {
    key: 'p50_latency',
    label: 'p50 latency',
    format: 'ms',
    goal: 'lower-better',
  },
  {
    key: 'p99_latency',
    label: 'p99 latency',
    format: 'ms',
    goal: 'lower-better',
  },
];

export interface ComparisonMetric {
  key: MetricDef['key'];
  label: string;
  format: MetricFormat;
  goal: MetricGoal;
  baseline: number;
  /** Whether `baseline` has a real denominator (see detectionRateDefined /
   * fpRateDefined) - false means the value is a meaningless 0% rather than
   * an actual measurement. Always true for the latency metrics. */
  baselineDefined: boolean;
  candidate: number;
  /** Same as `baselineDefined`, for `candidate`. */
  candidateDefined: boolean;
  /**
   * candidate − baseline, in the metric's native units. null when either
   * side's rate is undefined (zero-denominator) - there is nothing
   * meaningful to subtract.
   */
  delta: number | null;
  deltaDirection: DeltaDirection;
}

function classifyDelta(delta: number, goal: MetricGoal): DeltaDirection {
  if (delta === 0) return 'neutral';
  const isBetter = goal === 'higher-better' ? delta > 0 : delta < 0;

  return isBetter ? 'improved' : 'regressed';
}

/**
 * Whether a run's detection rate has a real denominator (attack rows > 0).
 * A run persisted before the count breakdown existed carries no `counts` at
 * all - keep today's behaviour for those and treat the rate as defined
 * rather than guessing from row_count.
 */
export function detectionRateDefined(run: BenchmarkRun): boolean {
  return run.counts === undefined || run.counts.attacks > 0;
}

/** Whether a run's false-positive rate has a real denominator (benign rows > 0). */
export function fpRateDefined(run: BenchmarkRun): boolean {
  return run.counts === undefined || run.counts.benign > 0;
}

function rateDefined(key: MetricDef['key'], run: BenchmarkRun): boolean {
  if (key === 'detection_rate') return detectionRateDefined(run);
  if (key === 'fp_rate') return fpRateDefined(run);

  return true;
}

/**
 * Format one side of a comparison-table cell: "n/a" when that run's rate is
 * undefined for this metric (see detectionRateDefined/fpRateDefined),
 * otherwise the normal formatted value.
 */
export function formatRate(
  value: number,
  format: MetricFormat,
  defined: boolean
): string {
  return defined ? formatMetric(value, format) : 'n/a';
}

/**
 * Whether the baseline and candidate runs were measured against different
 * corpora - when true, their rates are not directly comparable and callers
 * should warn before trusting the delta.
 */
export function corporaMismatched(
  baseline: BenchmarkRun,
  candidate: BenchmarkRun
): boolean {
  return baseline.corpus_version !== candidate.corpus_version;
}

/** Build the per-metric comparison rows for a baseline → candidate pair. */
export function compareRuns(
  baseline: BenchmarkRun,
  candidate: BenchmarkRun
): ComparisonMetric[] {
  return COMPARISON_METRICS.map((m) => {
    const baselineDefined = rateDefined(m.key, baseline);
    const candidateDefined = rateDefined(m.key, candidate);
    const baseValue = baseline[m.key];
    const candidateValue = candidate[m.key];
    const delta =
      baselineDefined && candidateDefined ? candidateValue - baseValue : null;

    return {
      key: m.key,
      label: m.label,
      format: m.format,
      goal: m.goal,
      baseline: baseValue,
      baselineDefined,
      candidate: candidateValue,
      candidateDefined,
      delta,
      deltaDirection: delta === null ? 'neutral' : classifyDelta(delta, m.goal),
    };
  });
}

/**
 * Pick a sensible default pair: candidate = newest run; baseline = newest run
 * with a *different* engine (the canonical stub-vs-DeBERTa comparison), falling
 * back to the second-newest run. Returns null when fewer than two runs exist.
 */
export function defaultComparisonPair(
  runs: BenchmarkRun[]
): { baselineId: string; candidateId: string } | null {
  if (runs.length < 2) return null;

  const byNewest = [...runs].sort((a, b) => b.ran_at - a.ran_at);
  const candidate = byNewest[0];
  const baseline =
    byNewest.find((r) => r.engine !== candidate.engine) ?? byNewest[1];

  return { baselineId: baseline.id, candidateId: candidate.id };
}

/** A signed horizontal bar rendering of one metric's delta in the comparison table. */
export interface ComparisonDeltaBar {
  key: MetricDef['key'];
  /** |delta| relative to the largest |delta| among the given metrics, 0-1. */
  fraction: number;
  /** Which side of center the bar fills. 'neutral' renders no fill (delta is 0). */
  direction: 'positive' | 'negative' | 'neutral';
}

/**
 * Scale each metric's delta into a bar fraction relative to the largest
 * |delta| among metrics that share its unit (percent vs ms), so the biggest
 * mover within each unit family fills the full bar width and the rest sit
 * proportionally below it. Normalizing across the whole set instead of per
 * format would make a detection-rate delta (a few percentage points, raw
 * value ~0.01-0.1) permanently invisible next to a latency delta (hundreds
 * to thousands of raw ms) - the two are not on a comparable numeric scale
 * even when both are equally significant to their own metric's range.
 */
export function comparisonDeltaBars(
  metrics: readonly ComparisonMetric[]
): ComparisonDeltaBar[] {
  const maxAbsDeltaByFormat = new Map<MetricFormat, number>();
  for (const m of metrics) {
    if (m.delta === null) continue;
    const current = maxAbsDeltaByFormat.get(m.format) ?? 0;
    maxAbsDeltaByFormat.set(m.format, Math.max(current, Math.abs(m.delta)));
  }

  return metrics.map((m): ComparisonDeltaBar => {
    // No denominator on one side - nothing meaningful to plot.
    if (m.delta === null)
      return { key: m.key, fraction: 0, direction: 'neutral' };

    const maxAbsDelta = maxAbsDeltaByFormat.get(m.format) ?? 0;

    return {
      key: m.key,
      fraction: maxAbsDelta === 0 ? 0 : Math.abs(m.delta) / maxAbsDelta,
      direction:
        m.delta === 0 ? 'neutral' : m.delta > 0 ? 'positive' : 'negative',
    };
  });
}

/**
 * Row-count segment of a run's picker label: "2508 rows" or, when the run
 * carries a count breakdown, "2508 rows · 0 attacks / 2508 benign". A run
 * persisted before the breakdown existed has no `counts` - it shows only
 * the row count, same as today.
 */
export function runRowCountLabel(run: BenchmarkRun): string {
  if (!run.counts) return `${run.row_count} rows`;

  return `${run.row_count} rows · ${run.counts.attacks} attacks / ${run.counts.benign} benign`;
}

/** Human label for a run in a selector: engine · corpus · gateway · date · rows. */
export function runOptionLabel(run: BenchmarkRun): string {
  const date = new Date(run.ran_at * 1000).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${run.engine} · ${abbreviateHash(run.corpus_version)} · ${run.gateway_version} · ${date} · ${runRowCountLabel(run)}`;
}

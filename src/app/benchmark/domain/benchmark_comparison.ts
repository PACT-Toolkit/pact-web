import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { abbreviateHash } from '@/src/framework/format/abbreviate_hash';
import { type MetricFormat } from '@/src/framework/format/metric_format';

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
  candidate: number;
  /** candidate − baseline, in the metric's native units. */
  delta: number;
  deltaDirection: DeltaDirection;
}

function classifyDelta(delta: number, goal: MetricGoal): DeltaDirection {
  if (delta === 0) return 'neutral';
  const isBetter = goal === 'higher-better' ? delta > 0 : delta < 0;

  return isBetter ? 'improved' : 'regressed';
}

/** Build the per-metric comparison rows for a baseline → candidate pair. */
export function compareRuns(
  baseline: BenchmarkRun,
  candidate: BenchmarkRun
): ComparisonMetric[] {
  return COMPARISON_METRICS.map((m) => {
    const baseValue = baseline[m.key];
    const candidateValue = candidate[m.key];
    const delta = candidateValue - baseValue;

    return {
      key: m.key,
      label: m.label,
      format: m.format,
      goal: m.goal,
      baseline: baseValue,
      candidate: candidateValue,
      delta,
      deltaDirection: classifyDelta(delta, m.goal),
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
    const current = maxAbsDeltaByFormat.get(m.format) ?? 0;
    maxAbsDeltaByFormat.set(m.format, Math.max(current, Math.abs(m.delta)));
  }

  return metrics.map((m): ComparisonDeltaBar => {
    const maxAbsDelta = maxAbsDeltaByFormat.get(m.format) ?? 0;

    return {
      key: m.key,
      fraction: maxAbsDelta === 0 ? 0 : Math.abs(m.delta) / maxAbsDelta,
      direction:
        m.delta === 0 ? 'neutral' : m.delta > 0 ? 'positive' : 'negative',
    };
  });
}

/** Human label for a run in a selector: engine · corpus · gateway · date. */
export function runOptionLabel(run: BenchmarkRun): string {
  const date = new Date(run.ran_at * 1000).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return `${run.engine} · ${abbreviateHash(run.corpus_version)} · ${run.gateway_version} · ${date}`;
}

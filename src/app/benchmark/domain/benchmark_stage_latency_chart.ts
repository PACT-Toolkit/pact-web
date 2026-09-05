import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';

/**
 * Series config for the per-stage chart's two bars. Same categorical colors
 * as `LATENCY_SERIES` (p50 = chart-3, p99 = chart-4) so the color -> metric
 * mapping stays consistent with the latency trend chart above it.
 */
export const STAGE_LATENCY_SERIES: Record<
  'p50Ms' | 'p99Ms',
  { label: string; color: string }
> = {
  p50Ms: { label: 'p50 latency', color: 'var(--chart-3)' },
  p99Ms: { label: 'p99 latency', color: 'var(--chart-4)' },
};

/** One grouped-bar entry on the per-stage latency chart. */
export interface StageLatencyChartPoint {
  layer: string;
  p50Ms: number;
  p99Ms: number;
  samples: number;
}

/**
 * Map a run's `per_layer` breakdown into chart points, preserving the
 * producer's own layer order (the gateway reports them in real pipeline
 * execution order) rather than re-sorting by a client-side stage list.
 * Returns an empty array when the run has no breakdown (pre-migration run)
 * or is undefined (no run selected yet).
 */
export function stageLatencyChartData(
  run: BenchmarkRun | undefined
): StageLatencyChartPoint[] {
  if (!run?.per_layer) return [];

  return run.per_layer.map((l) => ({
    layer: l.layer,
    p50Ms: l.p50_ms,
    p99Ms: l.p99_ms,
    samples: l.samples,
  }));
}

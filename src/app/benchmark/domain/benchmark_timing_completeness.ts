import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';

/** One layer row of the timing completeness card. */
export interface TimingCompletenessLayerView {
  layer: string;
  rowsWithSignal: number;
  rowsMissingDuration: number;
  /** True when at least one row carried the layer object without a duration_ms. */
  missing: boolean;
}

/** The "rows missing stages" line of the timing completeness card. */
export interface TimingCompletenessStagesView {
  rowsMissing: number;
  rowsTotal: number;
  /** True when at least one answered row carried no stages list. */
  missing: boolean;
}

/**
 * View model of a run's timing completeness summary. `recorded: false` is a
 * run stored before the summary existed (the wire key is absent): it must
 * read as "not recorded", never as zeros.
 */
export type TimingCompletenessView =
  | { recorded: false }
  | {
      recorded: true;
      layers: TimingCompletenessLayerView[];
      stages: TimingCompletenessStagesView;
    };

/**
 * Derive the timing completeness view from a run. Layers keep the producer's
 * wire order. A layer with no signal (rows_with_signal 0, e.g. consensus when
 * the inline stage did not run) reads as 0 and is not a failure: only
 * `rows_missing_duration > 0` marks a layer missing.
 */
export function timingCompletenessView(
  run: BenchmarkRun | undefined
): TimingCompletenessView {
  const summary = run?.timing_completeness;
  if (!summary) return { recorded: false };

  return {
    recorded: true,
    layers: summary.layers.map((l) => ({
      layer: l.layer,
      rowsWithSignal: l.rows_with_signal,
      rowsMissingDuration: l.rows_missing_duration,
      missing: l.rows_missing_duration > 0,
    })),
    stages: {
      rowsMissing: summary.rows_missing_stages,
      rowsTotal: summary.rows_total,
      missing: summary.rows_missing_stages > 0,
    },
  };
}

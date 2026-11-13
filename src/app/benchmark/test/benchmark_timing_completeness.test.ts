import { describe, expect, it } from 'vitest';

import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { timingCompletenessView } from '@/src/app/benchmark/domain/benchmark_timing_completeness';

type Summary = NonNullable<BenchmarkRun['timing_completeness']>;

function makeRun(timing_completeness?: Summary): BenchmarkRun {
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

const LAYER_ORDER = [
  'filter',
  'classifier',
  'consensus',
  'redactor',
  'policy',
  'external_refs',
];

function makeSummary(overrides: Partial<Summary> = {}): Summary {
  return {
    rows_total: 20,
    rows_missing_stages: 0,
    layers: LAYER_ORDER.map((layer) => ({
      layer,
      rows_with_signal: 20,
      rows_missing_duration: 0,
    })),
    ...overrides,
  };
}

describe('timingCompletenessView', () => {
  it('reads every layer and the stages line as pass when nothing is missing', () => {
    const view = timingCompletenessView(makeRun(makeSummary()));

    expect(view.recorded).toBe(true);
    if (!view.recorded) return;
    expect(view.layers.map((l) => l.layer)).toEqual(LAYER_ORDER);
    expect(view.layers.every((l) => !l.missing)).toBe(true);
    expect(view.stages).toEqual({
      rowsMissing: 0,
      rowsTotal: 20,
      missing: false,
    });
  });

  it('marks only the layer with rows missing a duration', () => {
    const summary = makeSummary();
    summary.layers[3] = {
      layer: 'redactor',
      rows_with_signal: 20,
      rows_missing_duration: 2,
    };
    const view = timingCompletenessView(makeRun(summary));

    expect(view.recorded).toBe(true);
    if (!view.recorded) return;
    expect(view.layers.filter((l) => l.missing).map((l) => l.layer)).toEqual([
      'redactor',
    ]);
    expect(view.layers[3]).toEqual({
      layer: 'redactor',
      rowsWithSignal: 20,
      rowsMissingDuration: 2,
      missing: true,
    });
    expect(view.stages.missing).toBe(false);
  });

  it('marks the stages line missing with rows_total as the denominator', () => {
    const view = timingCompletenessView(
      makeRun(makeSummary({ rows_missing_stages: 3, rows_total: 18 }))
    );

    expect(view.recorded).toBe(true);
    if (!view.recorded) return;
    expect(view.stages).toEqual({
      rowsMissing: 3,
      rowsTotal: 18,
      missing: true,
    });
    expect(view.layers.every((l) => !l.missing)).toBe(true);
  });

  it('is not recorded when the summary key is absent', () => {
    expect(timingCompletenessView(makeRun(undefined))).toEqual({
      recorded: false,
    });
  });

  it('is not recorded when there is no run', () => {
    expect(timingCompletenessView(undefined)).toEqual({ recorded: false });
  });

  it('reads a layer with no signal as 0 and not missing', () => {
    const view = timingCompletenessView(
      makeRun(
        makeSummary({
          layers: [
            {
              layer: 'consensus',
              rows_with_signal: 0,
              rows_missing_duration: 0,
            },
          ],
        })
      )
    );

    expect(view.recorded).toBe(true);
    if (!view.recorded) return;
    expect(view.layers).toEqual([
      {
        layer: 'consensus',
        rowsWithSignal: 0,
        rowsMissingDuration: 0,
        missing: false,
      },
    ]);
  });
});

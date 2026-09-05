import { describe, expect, it } from 'vitest';

import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { stageLatencyChartData } from '@/src/app/benchmark/domain/benchmark_stage_latency_chart';

function makeRun(overrides: Partial<BenchmarkRun>): BenchmarkRun {
  return {
    id: 'run-1',
    gateway_version: 'v1.0.0',
    engine: 'deberta',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.95,
    fp_rate: 0.05,
    p50_latency: 20,
    p99_latency: 100,
    row_count: 200,
    ran_at: 1_700_000_000,
    ...overrides,
  };
}

describe('stageLatencyChartData', () => {
  it('returns an empty array for an undefined run', () => {
    expect(stageLatencyChartData(undefined)).toEqual([]);
  });

  it('returns an empty array when the run has no per_layer breakdown', () => {
    expect(stageLatencyChartData(makeRun({ per_layer: undefined }))).toEqual(
      []
    );
  });

  it('preserves the producer-given layer order rather than re-sorting', () => {
    const run = makeRun({
      per_layer: [
        { layer: 'consensus', samples: 100, p50_ms: 300, p99_ms: 900 },
        { layer: 'filter', samples: 100, p50_ms: 5, p99_ms: 20 },
      ],
    });

    const result = stageLatencyChartData(run);

    expect(result.map((p) => p.layer)).toEqual(['consensus', 'filter']);
  });

  it('maps p50_ms, p99_ms, and samples for every layer', () => {
    const run = makeRun({
      per_layer: [
        { layer: 'filter', samples: 200, p50_ms: 4.2, p99_ms: 18.9 },
        { layer: 'classifier', samples: 200, p50_ms: 120.5, p99_ms: 480.1 },
        { layer: 'redactor', samples: 180, p50_ms: 2.1, p99_ms: 9.4 },
        { layer: 'consensus', samples: 40, p50_ms: 310, p99_ms: 1120 },
      ],
    });

    const result = stageLatencyChartData(run);

    expect(result).toEqual([
      { layer: 'filter', p50Ms: 4.2, p99Ms: 18.9, samples: 200 },
      { layer: 'classifier', p50Ms: 120.5, p99Ms: 480.1, samples: 200 },
      { layer: 'redactor', p50Ms: 2.1, p99Ms: 9.4, samples: 180 },
      { layer: 'consensus', p50Ms: 310, p99Ms: 1120, samples: 40 },
    ]);
  });
});

import { describe, expect, it } from 'vitest';

import {
  compareRuns,
  comparisonDeltaBars,
  corporaMismatched,
  defaultComparisonPair,
  detectionRateDefined,
  formatRate,
  fpRateDefined,
  runOptionLabel,
  runRowCountLabel,
} from '@/src/app/benchmark/domain/benchmark_comparison';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';

const makeRun = (overrides: Partial<BenchmarkRun>): BenchmarkRun => ({
  id: 'run',
  gateway_version: 'v0.0.0',
  engine: 'stub',
  corpus_version: 'seed-v1.jsonl',
  detection_rate: 0.8,
  fp_rate: 0.05,
  p50_latency: 12,
  p99_latency: 80,
  row_count: 100,
  ran_at: 1_000,
  ...overrides,
});

describe('compareRuns', () => {
  const baseline = makeRun({
    id: 'a',
    detection_rate: 0.8,
    fp_rate: 0.05,
    p50_latency: 12,
    p99_latency: 80,
  });
  const candidate = makeRun({
    id: 'b',
    detection_rate: 0.9,
    fp_rate: 0.03,
    p50_latency: 14,
    p99_latency: 70,
  });

  const metrics = compareRuns(baseline, candidate);
  const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));

  it('returns the four metrics in display order', () => {
    expect(metrics.map((m) => m.key)).toEqual([
      'detection_rate',
      'fp_rate',
      'p50_latency',
      'p99_latency',
    ]);
  });

  it('marks a higher detection rate as improved', () => {
    expect(byKey.detection_rate.delta).toBeCloseTo(0.1);
    expect(byKey.detection_rate.deltaDirection).toBe('improved');
  });

  it('marks a lower FP rate as improved (lower-better)', () => {
    expect(byKey.fp_rate.deltaDirection).toBe('improved');
  });

  it('marks higher latency as regressed (lower-better)', () => {
    expect(byKey.p50_latency.deltaDirection).toBe('regressed');
  });

  it('marks lower latency as improved (lower-better)', () => {
    expect(byKey.p99_latency.deltaDirection).toBe('improved');
  });

  it('treats an identical value as neutral', () => {
    const same = compareRuns(baseline, baseline);
    expect(same.every((m) => m.deltaDirection === 'neutral')).toBe(true);
  });

  it('marks every metric defined when neither run carries counts', () => {
    expect(metrics.every((m) => m.baselineDefined && m.candidateDefined)).toBe(
      true
    );
    expect(metrics.every((m) => m.delta !== null)).toBe(true);
  });
});

describe('detectionRateDefined', () => {
  it('is true for a run with no counts (pre-breakdown run)', () => {
    expect(detectionRateDefined(makeRun({}))).toBe(true);
  });

  it('is true when the run has at least one attack row', () => {
    const run = makeRun({
      counts: {
        attacks: 1,
        benign: 0,
        errors: 0,
        false_positives: 0,
        true_positives: 1,
        throttled: 0,
      },
    });
    expect(detectionRateDefined(run)).toBe(true);
  });

  it('is false for an attack-free run (zero-denominator detection rate)', () => {
    const run = makeRun({
      counts: {
        attacks: 0,
        benign: 2508,
        errors: 0,
        false_positives: 1698,
        true_positives: 0,
        throttled: 0,
      },
    });
    expect(detectionRateDefined(run)).toBe(false);
  });
});

describe('fpRateDefined', () => {
  it('is true for a run with no counts (pre-breakdown run)', () => {
    expect(fpRateDefined(makeRun({}))).toBe(true);
  });

  it('is false for a benign-free run (zero-denominator FP rate)', () => {
    const run = makeRun({
      counts: {
        attacks: 6,
        benign: 0,
        errors: 0,
        false_positives: 0,
        true_positives: 6,
        throttled: 0,
      },
    });
    expect(fpRateDefined(run)).toBe(false);
  });
});

describe('formatRate', () => {
  it('formats the value when defined', () => {
    expect(formatRate(0.883, 'percent', true)).toBe('88.3%');
    expect(formatRate(120, 'ms', true)).toBe('120.0 ms');
  });

  it('renders n/a when undefined, regardless of format', () => {
    expect(formatRate(0, 'percent', false)).toBe('n/a');
    expect(formatRate(0, 'ms', false)).toBe('n/a');
  });
});

describe('corporaMismatched', () => {
  it('is false when both runs share a corpus_version', () => {
    const a = makeRun({ id: 'a', corpus_version: 'seed-v1.jsonl' });
    const b = makeRun({ id: 'b', corpus_version: 'seed-v1.jsonl' });
    expect(corporaMismatched(a, b)).toBe(false);
  });

  it('is true when the runs come from different corpora', () => {
    const a = makeRun({ id: 'a', corpus_version: 'seed-v1.jsonl' });
    const b = makeRun({ id: 'b', corpus_version: 'seed-v2.jsonl' });
    expect(corporaMismatched(a, b)).toBe(true);
  });
});

describe('compareRuns with a zero-denominator run', () => {
  it('nulls the detection-rate delta when the candidate has no attack rows', () => {
    const baseline = makeRun({
      id: 'baseline',
      detection_rate: 1,
      fp_rate: 0,
      counts: {
        attacks: 5,
        benign: 1,
        errors: 0,
        false_positives: 0,
        true_positives: 5,
        throttled: 0,
      },
    });
    const candidate = makeRun({
      id: 'candidate',
      detection_rate: 0,
      fp_rate: 0.677,
      counts: {
        attacks: 0,
        benign: 2508,
        errors: 0,
        false_positives: 1698,
        true_positives: 0,
        throttled: 0,
      },
    });

    const metrics = compareRuns(baseline, candidate);
    const byKey = Object.fromEntries(metrics.map((m) => [m.key, m]));

    expect(byKey.detection_rate.candidateDefined).toBe(false);
    expect(byKey.detection_rate.delta).toBeNull();
    expect(byKey.detection_rate.deltaDirection).toBe('neutral');

    // Both sides have benign rows, so the FP-rate delta is still defined.
    expect(byKey.fp_rate.baselineDefined).toBe(true);
    expect(byKey.fp_rate.candidateDefined).toBe(true);
    expect(byKey.fp_rate.delta).not.toBeNull();

    // Latency never depends on counts.
    expect(byKey.p50_latency.delta).not.toBeNull();
  });
});

describe('comparisonDeltaBars', () => {
  it('returns an empty array for no metrics', () => {
    expect(comparisonDeltaBars([])).toEqual([]);
  });

  it('scales each metric relative to the largest |delta| within its own unit (percent vs ms)', () => {
    // Percent-format deltas (0.01-0.1 raw) and ms-format deltas (tens-to-
    // hundreds raw) are normalized within their own group, not against each
    // other - otherwise a detection-rate swing would render as an invisible
    // sliver next to any latency change, however small.
    const baseline = makeRun({
      id: 'a',
      detection_rate: 0.8,
      fp_rate: 0.05,
      p50_latency: 100,
      p99_latency: 400,
    });
    const candidate = makeRun({
      id: 'b',
      detection_rate: 0.9, // +0.1 (largest absolute delta within percent)
      fp_rate: 0.04, // -0.01
      p50_latency: 150, // +50 (largest absolute delta within ms)
      p99_latency: 400, // +0
    });

    const bars = comparisonDeltaBars(compareRuns(baseline, candidate));
    const byKey = Object.fromEntries(bars.map((b) => [b.key, b]));

    expect(byKey.detection_rate.fraction).toBe(1);
    expect(byKey.detection_rate.direction).toBe('positive');
    expect(byKey.fp_rate.fraction).toBeCloseTo(0.01 / 0.1, 5);
    expect(byKey.fp_rate.direction).toBe('negative');

    expect(byKey.p50_latency.fraction).toBe(1);
    expect(byKey.p50_latency.direction).toBe('positive');
    expect(byKey.p99_latency.fraction).toBe(0);
    expect(byKey.p99_latency.direction).toBe('neutral');
  });

  it('returns zero-fraction neutral bars when every delta is zero', () => {
    const baseline = makeRun({ id: 'a' });
    const bars = comparisonDeltaBars(compareRuns(baseline, baseline));

    expect(bars.every((b) => b.fraction === 0)).toBe(true);
    expect(bars.every((b) => b.direction === 'neutral')).toBe(true);
  });

  it('renders a zero-fraction neutral bar for a null (zero-denominator) delta', () => {
    const baseline = makeRun({
      id: 'baseline',
      detection_rate: 1,
      counts: {
        attacks: 5,
        benign: 1,
        errors: 0,
        false_positives: 0,
        true_positives: 5,
        throttled: 0,
      },
    });
    const candidate = makeRun({
      id: 'candidate',
      detection_rate: 0,
      counts: {
        attacks: 0,
        benign: 10,
        errors: 0,
        false_positives: 0,
        true_positives: 0,
        throttled: 0,
      },
    });

    const bars = comparisonDeltaBars(compareRuns(baseline, candidate));
    const byKey = Object.fromEntries(bars.map((b) => [b.key, b]));

    expect(byKey.detection_rate.fraction).toBe(0);
    expect(byKey.detection_rate.direction).toBe('neutral');
  });
});

describe('defaultComparisonPair', () => {
  it('returns null with fewer than two runs', () => {
    expect(defaultComparisonPair([])).toBeNull();
    expect(defaultComparisonPair([makeRun({ id: 'only' })])).toBeNull();
  });

  it('prefers a different-engine baseline against the newest candidate', () => {
    const runs = [
      makeRun({ id: 'old-stub', engine: 'stub', ran_at: 100 }),
      makeRun({ id: 'mid-stub', engine: 'stub', ran_at: 200 }),
      makeRun({ id: 'new-deberta', engine: 'deberta', ran_at: 300 }),
    ];
    expect(defaultComparisonPair(runs)).toEqual({
      candidateId: 'new-deberta',
      baselineId: 'mid-stub',
    });
  });

  it('falls back to the second-newest run when all engines match', () => {
    const runs = [
      makeRun({ id: 'old', engine: 'stub', ran_at: 100 }),
      makeRun({ id: 'mid', engine: 'stub', ran_at: 200 }),
      makeRun({ id: 'new', engine: 'stub', ran_at: 300 }),
    ];
    expect(defaultComparisonPair(runs)).toEqual({
      candidateId: 'new',
      baselineId: 'mid',
    });
  });
});

describe('runRowCountLabel', () => {
  it('shows only the row count when the run has no counts', () => {
    const run = makeRun({ row_count: 100 });
    expect(runRowCountLabel(run)).toBe('100 rows');
  });

  it('appends the attack/benign split when counts exist', () => {
    const run = makeRun({
      row_count: 2508,
      counts: {
        attacks: 0,
        benign: 2508,
        errors: 0,
        false_positives: 1698,
        true_positives: 0,
        throttled: 0,
      },
    });
    expect(runRowCountLabel(run)).toBe('2508 rows · 0 attacks / 2508 benign');
  });
});

describe('runOptionLabel', () => {
  it('abbreviates a long corpus hash and appends the row count', () => {
    const run = makeRun({
      corpus_version:
        'a1b2c3d4e5f60718293a4b5c6d7e8f9091a2b3c4d5e6f7081920a1b2c3d4e5f',
      engine: 'deberta',
      gateway_version: 'v1.2.3',
      ran_at: 1_700_000_000,
      row_count: 100,
    });

    expect(runOptionLabel(run)).toBe(
      'deberta · a1b2c3d4 · v1.2.3 · 14 Nov 2023 · 100 rows'
    );
  });

  it('appends the attack/benign split when the run carries counts', () => {
    const run = makeRun({
      corpus_version: 'seed-v1.jsonl',
      engine: 'stub',
      gateway_version: 'v0.3.0',
      ran_at: 1_700_000_000,
      row_count: 60,
      counts: {
        attacks: 40,
        benign: 20,
        errors: 0,
        false_positives: 1,
        true_positives: 38,
        throttled: 0,
      },
    });

    expect(runOptionLabel(run)).toBe(
      'stub · seed-v1.jsonl · v0.3.0 · 14 Nov 2023 · 60 rows · 40 attacks / 20 benign'
    );
  });
});

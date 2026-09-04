import { describe, expect, it } from 'vitest';

import {
  compareRuns,
  comparisonDeltaBars,
  defaultComparisonPair,
  runOptionLabel,
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

describe('runOptionLabel', () => {
  it('abbreviates a long corpus hash so the picker option stays short', () => {
    const run = makeRun({
      corpus_version:
        'a1b2c3d4e5f60718293a4b5c6d7e8f9091a2b3c4d5e6f7081920a1b2c3d4e5f',
      engine: 'deberta',
      gateway_version: 'v1.2.3',
      ran_at: 1_700_000_000,
    });

    expect(runOptionLabel(run)).toBe(
      'deberta · a1b2c3d4 · v1.2.3 · 14 Nov 2023'
    );
  });
});

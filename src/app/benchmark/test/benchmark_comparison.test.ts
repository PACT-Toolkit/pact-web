import { describe, expect, it } from 'vitest';

import {
  compareRuns,
  defaultComparisonPair,
  formatDelta,
  formatMetric,
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

describe('formatMetric', () => {
  it('formats percent metrics', () => {
    expect(formatMetric(0.834, 'percent')).toBe('83.4%');
  });

  it('formats latency in ms', () => {
    expect(formatMetric(12.34, 'ms')).toBe('12.3 ms');
  });
});

describe('formatDelta', () => {
  it('shows percentage points with a sign', () => {
    expect(formatDelta(0.1, 'percent')).toBe('+10.0 pp');
    expect(formatDelta(-0.02, 'percent')).toBe('-2.0 pp');
  });

  it('shows ms deltas with a sign', () => {
    expect(formatDelta(2, 'ms')).toBe('+2.0 ms');
    expect(formatDelta(-10, 'ms')).toBe('-10.0 ms');
  });
});

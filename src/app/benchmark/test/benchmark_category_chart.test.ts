import { describe, expect, it } from 'vitest';

import { type CategoryBreakdown } from '@/src/app/benchmark/domain/benchmark_breakdown';
import { categoryChartData } from '@/src/app/benchmark/domain/benchmark_category_chart';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';

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

describe('categoryChartData', () => {
  it('returns an empty array for an undefined run', () => {
    expect(categoryChartData(undefined)).toEqual([]);
  });

  it('returns an empty array when the run has no per_category breakdown', () => {
    expect(categoryChartData(makeRun({ per_category: undefined }))).toEqual([]);
  });

  it('sorts categories by attack count descending', () => {
    const run = makeRun({
      per_category: [
        {
          category: 'small',
          entries: 10,
          attacks: 10,
          benign: 0,
          detected: 9,
          fp: 0,
          errors: 0,
          throttled: 0,
        },
        {
          category: 'large',
          entries: 50,
          attacks: 50,
          benign: 0,
          detected: 45,
          fp: 0,
          errors: 0,
          throttled: 0,
        },
      ],
    });

    const result = categoryChartData(run);

    expect(result.map((p) => p.category)).toEqual(['large', 'small']);
  });

  it('computes detection rate, FP rate, and asymmetric Wilson error offsets', () => {
    const run = makeRun({
      per_category: [
        {
          category: 'prompt-hacking',
          entries: 70,
          attacks: 50,
          benign: 20,
          detected: 45,
          fp: 2,
          errors: 0,
          throttled: 0,
        },
      ],
    });

    const [point] = categoryChartData(run);

    expect(point.detectionRate).toBe(90);
    expect(point.detectionErrorOffset[0]).toBeCloseTo(11.4, 1);
    expect(point.detectionErrorOffset[1]).toBeCloseTo(5.7, 1);
    expect(point.fpRate).toBe(10);
    expect(point.fpErrorOffset[0]).toBeCloseTo(7.2, 1);
    expect(point.fpErrorOffset[1]).toBeCloseTo(20.1, 1);
  });

  it('reports a 0% detection rate for an attack-free (benign-only) category', () => {
    const run = makeRun({
      per_category: [
        {
          category: 'benign-chat',
          entries: 20,
          attacks: 0,
          benign: 20,
          detected: 0,
          fp: 1,
          errors: 0,
          throttled: 0,
        },
      ],
    });

    const [point] = categoryChartData(run);

    expect(point.detectionRate).toBe(0);
    expect(point.detectionErrorOffset).toEqual([0, 0]);
  });

  it('reports a 0% FP rate for a benign-free (attack-only) category', () => {
    const run = makeRun({
      per_category: [
        {
          category: 'jailbreak',
          entries: 20,
          attacks: 20,
          benign: 0,
          detected: 18,
          fp: 0,
          errors: 0,
          throttled: 0,
        },
      ],
    });

    const [point] = categoryChartData(run);

    expect(point.fpRate).toBe(0);
    expect(point.fpErrorOffset).toEqual([0, 0]);
  });

  it('carries attacks, benign, errors, and throttled through', () => {
    const run = makeRun({
      per_category: [
        {
          category: 'mixed-injection',
          entries: 30,
          attacks: 20,
          benign: 10,
          detected: 18,
          fp: 1,
          errors: 3,
          throttled: 4,
        },
      ],
    });

    const [point] = categoryChartData(run);

    expect(point.attacks).toBe(20);
    expect(point.benign).toBe(10);
    expect(point.errors).toBe(3);
    expect(point.throttled).toBe(4);
  });

  it('coalesces a category missing throttled entirely (pre-PACT-933 run) to zero', () => {
    const legacyCategory = {
      category: 'mixed-injection',
      entries: 30,
      attacks: 20,
      benign: 10,
      detected: 18,
      fp: 1,
      errors: 0,
      // throttled intentionally omitted - simulates a category persisted
      // before the field existed, despite the generated type marking it
      // required.
    } as unknown as CategoryBreakdown;
    const run = makeRun({ per_category: [legacyCategory] });

    const [point] = categoryChartData(run);

    expect(point.throttled).toBe(0);
  });
});

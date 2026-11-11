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
    degraded: false,
    ran_at: 1_700_000_000,
    ...overrides,
  };
}

/** A category row with every counter zero; tests override only what they exercise. */
const category = (
  overrides: Partial<CategoryBreakdown>
): CategoryBreakdown => ({
  category: 'mixed-injection',
  entries: 30,
  attacks: 20,
  benign: 10,
  detected: 18,
  fp: 1,
  errors: 0,
  mitigated: 0,
  throttled: 0,
  unscored: 0,
  ...overrides,
});

const onePoint = (overrides: Partial<CategoryBreakdown>) =>
  categoryChartData(makeRun({ per_category: [category(overrides)] }))[0];

describe('categoryChartData', () => {
  it('returns an empty array for an undefined run', () => {
    expect(categoryChartData(undefined)).toEqual([]);
  });

  it('returns an empty array when the run has no per_category breakdown', () => {
    expect(categoryChartData(makeRun({ per_category: undefined }))).toEqual([]);
  });

  it('sorts by attacks + benign descending, ties broken by name ascending', () => {
    const row = (name: string, attacks: number, benign: number) =>
      category({ category: name, attacks, benign, entries: attacks + benign });
    const run = makeRun({
      per_category: [
        row('small', 10, 0),
        row('zeta-tie', 0, 20),
        row('benign-heavy', 0, 200),
        row('alpha-tie', 12, 8),
        row('large-attack', 50, 0),
      ],
    });

    expect(categoryChartData(run).map((p) => p.category)).toEqual([
      'benign-heavy',
      'large-attack',
      'alpha-tie',
      'zeta-tie',
      'small',
    ]);
  });

  it('computes detection rate, FP rate, and asymmetric Wilson error offsets', () => {
    const point = onePoint({
      category: 'prompt-hacking',
      entries: 70,
      attacks: 50,
      benign: 20,
      detected: 45,
      fp: 2,
    });

    expect(point.detectionRate).toBe(90);
    expect(point.detectionErrorOffset![0]).toBeCloseTo(11.4, 1);
    expect(point.detectionErrorOffset![1]).toBeCloseTo(5.7, 1);
    expect(point.fpRate).toBe(10);
    expect(point.fpErrorOffset![0]).toBeCloseTo(7.2, 1);
    expect(point.fpErrorOffset![1]).toBeCloseTo(20.1, 1);
  });

  it('reports an undefined detection rate as null for a benign-only category', () => {
    const point = onePoint({
      category: 'benign-chat',
      attacks: 0,
      benign: 20,
      detected: 0,
      fp: 1,
    });

    expect(point.detectionRate).toBeNull();
    expect(point.detectionErrorOffset).toBeNull();
    expect(point.detectionInterval).toBeNull();
    expect(point.detectionCount).toBe('');
    expect(point.fpRate).toBe(5);
  });

  it('reports an undefined FP rate as null for an attack-only category', () => {
    const point = onePoint({
      category: 'jailbreak',
      attacks: 20,
      benign: 0,
      detected: 18,
      fp: 0,
    });

    expect(point.fpRate).toBeNull();
    expect(point.fpErrorOffset).toBeNull();
    expect(point.fpInterval).toBeNull();
    expect(point.fpCount).toBe('');
    expect(point.detectionRate).toBe(90);
  });

  it('keeps a true 0% rate as 0 with a non-zero upper Wilson bound', () => {
    const point = onePoint({
      category: 'benign-chat',
      attacks: 0,
      benign: 15,
      detected: 0,
      fp: 0,
    });

    expect(point.fpRate).toBe(0);
    expect(point.fpInterval).toEqual({ low: 0, high: 20.4 });
    expect(point.fpErrorOffset).toEqual([0, 20.4]);
    expect(point.fpCount).toBe('0/15');
  });

  it('keeps a zero detection rate with attack rows as 0, not null', () => {
    const point = onePoint({ attacks: 4, benign: 0, detected: 0, fp: 0 });

    expect(point.detectionRate).toBe(0);
    expect(point.detectionErrorOffset![1]).toBeGreaterThan(0);
    expect(point.detectionCount).toBe('0/4');
  });

  it('builds the offsets from the same rounded interval it reports', () => {
    const point = onePoint({ attacks: 5, benign: 0, detected: 5, fp: 0 });

    expect(point.detectionRate).toBe(100);
    expect(point.detectionInterval).toEqual({ low: 56.6, high: 100 });
    expect(point.detectionErrorOffset![0]).toBeCloseTo(43.4, 5);
    expect(point.detectionErrorOffset![1]).toBe(0);
    expect(point.detectionCount).toBe('5/5');
  });

  it('carries detected and fp through with the fraction labels', () => {
    const point = onePoint({ attacks: 20, benign: 10, detected: 18, fp: 1 });

    expect(point.detected).toBe(18);
    expect(point.fp).toBe(1);
    expect(point.attacks).toBe(20);
    expect(point.benign).toBe(10);
    expect(point.detectionCount).toBe('18/20');
    expect(point.fpCount).toBe('1/10');
  });

  it('carries errors and throttled through', () => {
    const point = onePoint({ errors: 3, throttled: 4 });

    expect(point.errors).toBe(3);
    expect(point.throttled).toBe(4);
  });

  it('coalesces a category missing throttled entirely (older run) to zero', () => {
    const legacyCategory = {
      ...category({}),
      // Simulates a category persisted before the field existed, despite the
      // generated type marking it required.
      throttled: undefined,
    } as unknown as CategoryBreakdown;

    const [point] = categoryChartData(
      makeRun({ per_category: [legacyCategory] })
    );

    expect(point.throttled).toBe(0);
  });
});

describe('categoryChartData unscored', () => {
  it('carries the per-category unscored count through', () => {
    expect(onePoint({ unscored: 6 }).unscored).toBe(6);
  });

  it('coalesces a category missing unscored entirely to zero', () => {
    const legacyCategory = {
      ...category({}),
      unscored: undefined,
    } as unknown as CategoryBreakdown;

    const [point] = categoryChartData(
      makeRun({ per_category: [legacyCategory] })
    );

    expect(point.unscored).toBe(0);
  });

  it('annotates the detection bar with throttled and unscored counts, omitting zeros', () => {
    const points = categoryChartData(
      makeRun({
        per_category: [
          category({
            category: 'both',
            attacks: 40,
            throttled: 2,
            unscored: 5,
          }),
          category({ category: 'only-unscored', attacks: 30, unscored: 4 }),
          category({ category: 'only-throttled', attacks: 20, throttled: 3 }),
          category({ category: 'neither', attacks: 10 }),
        ],
      })
    );
    const note = Object.fromEntries(
      points.map((p) => [p.category, p.detectionNote])
    );

    expect(note).toEqual({
      both: '2 thr · 5 unscored',
      'only-unscored': '4 unscored',
      'only-throttled': '3 thr',
      neither: '',
    });
  });

  it('puts the error count last on the detection note and leaves the FP note empty for a category with attack rows', () => {
    const point = onePoint({ attacks: 20, errors: 2, unscored: 9 });

    expect(point.detectionNote).toBe('9 unscored · 2 err');
    expect(point.fpNote).toBe('');
  });

  it('shows the error count of an attack-only category on its detection note', () => {
    const point = onePoint({
      category: 'jailbreak',
      attacks: 12,
      benign: 0,
      detected: 6,
      fp: 0,
      errors: 3,
    });

    expect(point.detectionNote).toBe('3 err');
    expect(point.fpNote).toBe('');
  });

  it('moves the counters to the FP bar for a category with no attack rows', () => {
    const point = onePoint({
      category: 'benign-chat',
      attacks: 0,
      benign: 25,
      detected: 0,
      errors: 1,
      throttled: 2,
      unscored: 7,
    });

    expect(point.detectionNote).toBe('');
    expect(point.fpNote).toBe('2 thr · 7 unscored · 1 err');
  });
});

describe('categoryChartData mitigated', () => {
  const attackOnly = (overrides: Partial<CategoryBreakdown>) =>
    onePoint({
      category: 'prompt-hacking',
      entries: 30,
      attacks: 30,
      benign: 0,
      detected: 20,
      fp: 0,
      ...overrides,
    });

  it('carries the per-category mitigated count and keeps the strict rate', () => {
    const point = attackOnly({ mitigated: 6 });

    expect(point.mitigated).toBe(6);
    expect(point.detectionRate).toBeCloseTo(66.7, 1);
  });

  it('coalesces a category missing mitigated entirely to zero', () => {
    const legacy = {
      ...category({}),
      mitigated: undefined,
    } as unknown as CategoryBreakdown;

    const [point] = categoryChartData(makeRun({ per_category: [legacy] }));

    expect(point.mitigated).toBe(0);
  });

  it('annotates the detection bar with throttled, mitigated, unscored and error counts in that order', () => {
    const point = attackOnly({
      mitigated: 6,
      throttled: 2,
      unscored: 5,
      errors: 4,
    });

    expect(point.detectionNote).toBe(
      '2 thr · 6 mitigated · 5 unscored · 4 err'
    );
  });
});

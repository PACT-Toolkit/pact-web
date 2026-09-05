import { describe, expect, it } from 'vitest';

import { type RunCounts } from '@/src/app/benchmark/domain/benchmark_breakdown';
import { deriveConfusionCounts } from '@/src/app/benchmark/domain/benchmark_confusion';

function makeCounts(overrides: Partial<RunCounts>): RunCounts {
  return {
    attacks: 100,
    benign: 100,
    true_positives: 95,
    false_positives: 5,
    errors: 0,
    throttled: 0,
    ...overrides,
  };
}

describe('deriveConfusionCounts', () => {
  it('derives all four confusion cells plus errors', () => {
    const counts = makeCounts({
      attacks: 100,
      benign: 80,
      true_positives: 92,
      false_positives: 6,
      errors: 3,
    });

    expect(deriveConfusionCounts(counts)).toEqual({
      truePositives: 92,
      falseNegatives: 8,
      falsePositives: 6,
      trueNegatives: 74,
      errors: 3,
      throttled: 0,
      throttledRate: 0,
    });
  });

  it('derives zero false negatives when every attack was detected', () => {
    const counts = makeCounts({ attacks: 50, true_positives: 50 });

    expect(deriveConfusionCounts(counts).falseNegatives).toBe(0);
  });

  it('derives zero true negatives when every benign row was flagged', () => {
    const counts = makeCounts({ benign: 30, false_positives: 30 });

    expect(deriveConfusionCounts(counts).trueNegatives).toBe(0);
  });

  it('carries throttled through and derives its rate against all rows the run touched', () => {
    // attacks 90 + benign 90 + errors 0 + throttled 20 = 200 total rows.
    const counts = makeCounts({
      attacks: 90,
      benign: 90,
      errors: 0,
      throttled: 20,
    });

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.throttled).toBe(20);
    expect(confusion.throttledRate).toBeCloseTo(0.1);
  });

  it('does not fold throttled into errors, attacks, or benign', () => {
    const counts = makeCounts({
      attacks: 100,
      benign: 100,
      true_positives: 95,
      false_positives: 5,
      errors: 3,
      throttled: 7,
    });

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.errors).toBe(3);
    expect(confusion.falseNegatives).toBe(5);
    expect(confusion.trueNegatives).toBe(95);
  });

  it('coalesces a missing throttled field (pre-PACT-933 counts) to zero', () => {
    const counts = {
      attacks: 100,
      benign: 100,
      true_positives: 95,
      false_positives: 5,
      errors: 0,
      // throttled intentionally omitted - simulates a run persisted before
      // the field existed, despite the generated type marking it required.
    } as unknown as RunCounts;

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.throttled).toBe(0);
    expect(confusion.throttledRate).toBe(0);
  });

  it('reports a zero throttled rate when the run has zero total rows', () => {
    const counts = makeCounts({
      attacks: 0,
      benign: 0,
      errors: 0,
      throttled: 0,
    });

    expect(deriveConfusionCounts(counts).throttledRate).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';

import { type RunCounts } from '@/src/app/benchmark/domain/benchmark_breakdown';
import {
  deriveConfusionCounts,
  effectiveDetectionRate,
} from '@/src/app/benchmark/domain/benchmark_confusion';

function makeCounts(overrides: Partial<RunCounts>): RunCounts {
  return {
    attacks: 100,
    benign: 100,
    true_positives: 95,
    false_positives: 5,
    errors: 0,
    mitigated: 0,
    throttled: 0,
    unscored: 0,
    requeues: 0,
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
      mitigated: 0,
      effectiveDetectionRate: 0.92,
      errors: 3,
      throttled: 0,
      throttledRate: 0,
      unscored: 0,
      unscoredRate: 0,
      requeues: 0,
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
      unscored: 0,
    });

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.throttled).toBe(20);
    expect(confusion.throttledRate).toBeCloseTo(0.1);
  });

  it('counts errored and unscored rows inside attacks and benign, not on top, in the rates', () => {
    // attacks 90 + benign 90 + throttled 20 = 200 rows; the 10 errored and 30
    // unscored rows are subsets of attacks/benign.
    const counts = makeCounts({
      attacks: 90,
      benign: 90,
      true_positives: 80,
      errors: 10,
      throttled: 20,
      unscored: 30,
    });

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.throttledRate).toBeCloseTo(0.1);
    expect(confusion.unscoredRate).toBeCloseTo(0.15);
  });

  it('does not fold throttled into errors, attacks, or benign', () => {
    const counts = makeCounts({
      attacks: 100,
      benign: 100,
      true_positives: 95,
      false_positives: 5,
      errors: 3,
      throttled: 7,
      unscored: 0,
    });

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.errors).toBe(3);
    expect(confusion.falseNegatives).toBe(5);
    expect(confusion.trueNegatives).toBe(95);
  });

  it('coalesces a missing throttled field (older counts) to zero', () => {
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
      unscored: 0,
    });

    expect(deriveConfusionCounts(counts).throttledRate).toBe(0);
  });

  it('carries unscored through and derives its rate against all rows the run touched', () => {
    // attacks 80 + benign 80 + throttled 0 = 160 rows; the 40 unscored rows
    // sit inside attacks/benign.
    const counts = makeCounts({
      attacks: 80,
      benign: 80,
      true_positives: 70,
      false_positives: 4,
      unscored: 40,
    });

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.unscored).toBe(40);
    expect(confusion.unscoredRate).toBeCloseTo(0.25);
  });

  it('does not fold unscored into the confusion cells or errors', () => {
    const counts = makeCounts({
      attacks: 100,
      benign: 100,
      true_positives: 95,
      false_positives: 5,
      errors: 3,
      unscored: 12,
    });

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.falseNegatives).toBe(5);
    expect(confusion.trueNegatives).toBe(95);
    expect(confusion.errors).toBe(3);
  });

  it('coalesces a missing unscored field (run persisted before it existed) to zero', () => {
    const counts = {
      attacks: 100,
      benign: 100,
      true_positives: 95,
      false_positives: 5,
      errors: 0,
      throttled: 0,
      // unscored intentionally omitted - simulates a run persisted before
      // the field existed, despite the generated type marking it required.
    } as unknown as RunCounts;

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.unscored).toBe(0);
    expect(confusion.unscoredRate).toBe(0);
  });

  it('reports a zero unscored rate when the run has zero total rows', () => {
    const counts = makeCounts({
      attacks: 0,
      benign: 0,
      errors: 0,
      throttled: 0,
      unscored: 0,
    });

    expect(deriveConfusionCounts(counts).unscoredRate).toBe(0);
  });
});

describe('mitigated', () => {
  it('keeps mitigated attacks out of the false negatives', () => {
    const counts = makeCounts({
      attacks: 100,
      true_positives: 80,
      mitigated: 12,
    });

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.mitigated).toBe(12);
    expect(confusion.falseNegatives).toBe(8);
    expect(confusion.truePositives).toBe(80);
  });

  it('derives the effective rate from true positives plus mitigated', () => {
    const counts = makeCounts({
      attacks: 100,
      true_positives: 80,
      mitigated: 12,
    });

    expect(deriveConfusionCounts(counts).effectiveDetectionRate).toBeCloseTo(
      0.92
    );
  });

  it('coalesces a missing mitigated field (run persisted before it existed) to zero', () => {
    const counts = {
      attacks: 100,
      benign: 100,
      true_positives: 95,
      false_positives: 5,
      errors: 0,
      throttled: 0,
      unscored: 0,
    } as unknown as RunCounts;

    const confusion = deriveConfusionCounts(counts);
    expect(confusion.mitigated).toBe(0);
    expect(confusion.falseNegatives).toBe(5);
    expect(confusion.effectiveDetectionRate).toBeCloseTo(0.95);
  });
});

describe('effectiveDetectionRate', () => {
  it('is (true positives + mitigated) / attacks', () => {
    expect(effectiveDetectionRate(56, 4, 60)).toBe(1);
    expect(effectiveDetectionRate(30, 15, 90)).toBe(0.5);
  });

  it('equals the strict rate when nothing was mitigated', () => {
    expect(effectiveDetectionRate(93, 0, 100)).toBe(0.93);
  });

  it('is 0 when the run has no attack rows', () => {
    expect(effectiveDetectionRate(0, 0, 0)).toBe(0);
  });
});

describe('deriveConfusionCounts requeues', () => {
  it('carries the requeue count without touching the confusion cells', () => {
    const withRequeues = deriveConfusionCounts(makeCounts({ requeues: 7 }));
    const without = deriveConfusionCounts(makeCounts({ requeues: 0 }));

    expect(withRequeues.requeues).toBe(7);
    expect({ ...withRequeues, requeues: 0 }).toEqual(without);
  });

  it('reads a missing requeues field (older run) as zero', () => {
    const counts = makeCounts({});
    delete (counts as Partial<RunCounts>).requeues;

    expect(deriveConfusionCounts(counts).requeues).toBe(0);
  });
});

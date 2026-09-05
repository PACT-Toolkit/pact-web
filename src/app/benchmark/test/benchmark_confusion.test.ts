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
});

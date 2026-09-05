import { type RunCounts } from '@/src/app/benchmark/domain/benchmark_breakdown';

/** The four confusion-matrix cells plus the error count, derived from a job's `counts`. */
export interface ConfusionCounts {
  truePositives: number;
  falseNegatives: number;
  falsePositives: number;
  trueNegatives: number;
  errors: number;
}

/**
 * Derive the confusion matrix from a job's `counts` breakdown. False
 * negatives and true negatives aren't reported directly on the wire - they
 * are the complement of true positives within attacks and false positives
 * within benign respectively (every attack row is either detected or
 * missed; every benign row is either flagged or correctly passed).
 */
export function deriveConfusionCounts(counts: RunCounts): ConfusionCounts {
  return {
    truePositives: counts.true_positives,
    falseNegatives: counts.attacks - counts.true_positives,
    falsePositives: counts.false_positives,
    trueNegatives: counts.benign - counts.false_positives,
    errors: counts.errors,
  };
}

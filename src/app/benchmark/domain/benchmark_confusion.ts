import { type RunCounts } from '@/src/app/benchmark/domain/benchmark_breakdown';

/** The four confusion-matrix cells plus the error and throttled counts, derived from a job's `counts`. */
export interface ConfusionCounts {
  truePositives: number;
  falseNegatives: number;
  falsePositives: number;
  trueNegatives: number;
  errors: number;
  /**
   * Rows that exhausted the runner's retry budget against HTTP 429 - the
   * gateway's rate limiter working, not a pipeline failure. Already
   * excluded from attacks/benign/errors on the wire (PACT-933), so it
   * never changes the four confusion cells above; it's surfaced here
   * purely so the run-detail tiles can show it next to Errors.
   */
  throttled: number;
  /** Throttled as a fraction of every row the run touched (0-1). */
  throttledRate: number;
}

/**
 * Derive the confusion matrix from a job's `counts` breakdown. False
 * negatives and true negatives aren't reported directly on the wire - they
 * are the complement of true positives within attacks and false positives
 * within benign respectively (every attack row is either detected or
 * missed; every benign row is either flagged or correctly passed).
 *
 * `counts.throttled` is coalesced to 0 rather than trusted as always
 * present: the generated type marks it required, but a `counts` object
 * persisted before the gateway added the field (PACT-933) won't actually
 * carry it on the wire - the same "don't assume presence" caveat
 * benchmark_breakdown.ts documents for the rest of this struct.
 */
export function deriveConfusionCounts(counts: RunCounts): ConfusionCounts {
  const throttled = counts.throttled ?? 0;
  const totalRows = counts.attacks + counts.benign + counts.errors + throttled;

  return {
    truePositives: counts.true_positives,
    falseNegatives: counts.attacks - counts.true_positives,
    falsePositives: counts.false_positives,
    trueNegatives: counts.benign - counts.false_positives,
    errors: counts.errors,
    throttled,
    throttledRate: totalRows > 0 ? throttled / totalRows : 0,
  };
}

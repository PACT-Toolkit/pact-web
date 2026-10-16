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
   * excluded from attacks/benign/errors on the wire, so it
   * never changes the four confusion cells above; it's surfaced here
   * purely so the run-detail tiles can show it next to Errors.
   */
  throttled: number;
  /** Throttled as a fraction of every row the run touched (0-1). */
  throttledRate: number;
  /**
   * Rows the gateway answered with a fail-open allow because the classifier
   * produced no verdict. They are neither a detected nor a missed attack, so
   * the wire keeps them out of attacks/benign and out of the detection and
   * false-positive rates; they never change the four confusion cells above.
   */
  unscored: number;
  /** Unscored as a fraction of every row the run touched (0-1). */
  unscoredRate: number;
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
 * persisted before the gateway added the field won't actually
 * carry it on the wire - the same "don't assume presence" caveat
 * benchmark_breakdown.ts documents for the rest of this struct. The same
 * goes for `counts.unscored`, absent on runs persisted before it existed.
 */
export function deriveConfusionCounts(counts: RunCounts): ConfusionCounts {
  const throttled = counts.throttled ?? 0;
  const unscored = counts.unscored ?? 0;
  const totalRows =
    counts.attacks + counts.benign + counts.errors + throttled + unscored;

  return {
    truePositives: counts.true_positives,
    falseNegatives: counts.attacks - counts.true_positives,
    falsePositives: counts.false_positives,
    trueNegatives: counts.benign - counts.false_positives,
    errors: counts.errors,
    throttled,
    throttledRate: totalRows > 0 ? throttled / totalRows : 0,
    unscored,
    unscoredRate: totalRows > 0 ? unscored / totalRows : 0,
  };
}

import { type RunCounts } from '@/src/app/benchmark/domain/benchmark_breakdown';

/** The four confusion-matrix cells plus the error and throttled counts, derived from a job's `counts`. */
export interface ConfusionCounts {
  truePositives: number;
  falseNegatives: number;
  falsePositives: number;
  trueNegatives: number;
  /**
   * Attack rows the gateway allowed after masking content (redacted, or
   * reason classifier_mitigated; see isMitigatedRow). Neither a detection nor a miss: they sit
   * inside attacks, outside true positives and outside false negatives.
   */
  mitigated: number;
  /**
   * (true positives + mitigated) / attacks, 0-1. An upper bound on what the
   * pipeline stopped: redaction masks PII but does not remove injected
   * instructions. The strict rate (true positives / attacks) stays the
   * headline. 0 when the run has no attack rows.
   */
  effectiveDetectionRate: number;
  errors: number;
  /**
   * Rows that exhausted the runner's retry budget against HTTP 429 - the
   * gateway's rate limiter working, not a pipeline failure. Already
   * outside attacks/benign on the wire, so it
   * never changes the four confusion cells above; it's surfaced here
   * purely so the run-detail tiles can show it next to Errors.
   */
  throttled: number;
  /** Throttled as a fraction of every row the run touched (0-1). */
  throttledRate: number;
  /**
   * Rows the gateway answered with a fail-open allow because the classifier
   * produced no verdict. The wire counts them inside attacks/benign as
   * allowed, so an unscored attack row is a miss; they are reported apart
   * only so the run shows how much of it the classifier never judged.
   */
  unscored: number;
  /** Unscored as a fraction of every row the run touched (0-1). */
  unscoredRate: number;
  /**
   * Times the runner put a row back after a 429/502/503/504 or a transport
   * error. A retried row is not a lost row: it still ends up in the cells
   * above, so this never changes them.
   */
  requeues: number;
}

/**
 * Effective detection rate: (true positives + mitigated) / attacks, 0-1.
 * Not on the wire, so it is derived here. Returns 0 when there are no attack
 * rows (no denominator), matching how the strict rate renders on such a run.
 */
export function effectiveDetectionRate(
  truePositives: number,
  mitigated: number,
  attacks: number
): number {
  return attacks > 0 ? (truePositives + mitigated) / attacks : 0;
}

/**
 * Derive the confusion matrix from a job's `counts` breakdown. False
 * negatives and true negatives aren't reported directly on the wire - false
 * negatives are the attacks neither detected nor mitigated, true negatives
 * the complement of false positives within benign (every attack row is
 * detected, mitigated or missed; every benign row is either flagged or
 * correctly passed).
 *
 * `counts.throttled` is coalesced to 0 rather than trusted as always
 * present: the generated type marks it required, but a `counts` object
 * persisted before the gateway added the field won't actually
 * carry it on the wire - the same "don't assume presence" caveat
 * benchmark_breakdown.ts documents for the rest of this struct. The same
 * goes for `counts.unscored`, `counts.mitigated` and `counts.requeues`, absent
 * on runs persisted before they existed.
 */
export function deriveConfusionCounts(counts: RunCounts): ConfusionCounts {
  const throttled = counts.throttled ?? 0;
  const unscored = counts.unscored ?? 0;
  const mitigated = counts.mitigated ?? 0;
  const requeues = counts.requeues ?? 0;
  // Errored and unscored rows are subsets of attacks/benign on the wire (an
  // allow nothing blocked); a throttled row is the only set outside them.
  const totalRows = counts.attacks + counts.benign + throttled;

  return {
    truePositives: counts.true_positives,
    falseNegatives: counts.attacks - counts.true_positives - mitigated,
    falsePositives: counts.false_positives,
    trueNegatives: counts.benign - counts.false_positives,
    mitigated,
    effectiveDetectionRate: effectiveDetectionRate(
      counts.true_positives,
      mitigated,
      counts.attacks
    ),
    errors: counts.errors,
    throttled,
    throttledRate: totalRows > 0 ? throttled / totalRows : 0,
    unscored,
    unscoredRate: totalRows > 0 ? unscored / totalRows : 0,
    requeues,
  };
}

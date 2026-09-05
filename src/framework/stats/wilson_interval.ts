// 95% two-sided normal quantile (z_{0.975}). Matches pact-benchmark's
// runner/stats.py wilson_interval so the web trend chart's confidence bands
// agree with the numbers pact-benchmark itself reports for the same run.
const Z_95 = 1.959964;

/** A confidence interval for a binomial proportion, both bounds in [0, 1]. */
export interface WilsonInterval {
  low: number;
  high: number;
}

/**
 * Wilson score confidence interval (95%) for a binomial proportion
 * `successes / trials`. Used to band the detection-rate and FP-rate trend
 * lines with their sampling uncertainty instead of presenting a point
 * estimate as if it were exact.
 *
 * `trials === 0` (or negative, which should never happen but is guarded the
 * same way) returns `{ low: 0, high: 0 }` rather than dividing by zero -
 * there is no observed rate to bound.
 */
export function wilsonInterval(
  successes: number,
  trials: number
): WilsonInterval {
  if (trials <= 0) return { low: 0, high: 0 };

  const p = successes / trials;
  const z2 = Z_95 * Z_95;
  const denominator = 1 + z2 / trials;
  const center = p + z2 / (2 * trials);
  const margin =
    Z_95 * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials));

  return {
    low: Math.max(0, (center - margin) / denominator),
    high: Math.min(1, (center + margin) / denominator),
  };
}

/**
 * Null-safe wrapper for a run/job whose `counts` breakdown may be absent
 * (pre-migration data - see benchmark_breakdown.ts). Returns `undefined`
 * rather than `{ low: 0, high: 0 }` so callers can distinguish "no data" from
 * "a real zero-width interval," letting a chart render a gap instead of a
 * misleading band pinned to zero.
 */
export function wilsonIntervalForCounts(
  successes: number | undefined,
  trials: number | undefined
): WilsonInterval | undefined {
  if (successes === undefined || trials === undefined) return undefined;

  return wilsonInterval(successes, trials);
}

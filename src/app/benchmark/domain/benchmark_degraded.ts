/**
 * Tooltip on the "degraded" marker of a benchmark run. The run's own
 * threshold decides the flag (the benchmark service sets `degraded`), so the
 * text never names a percentage.
 */
export const DEGRADED_TOOLTIP =
  "Rows were lost to errors, unscored verdicts or throttling (over the run's threshold) - rates are less reliable.";

/** Why a degraded run's detection and false-positive rates are not quotable. */
export const DEGRADED_NOT_QUOTABLE_REASON =
  'run degraded - rows were lost to errors, unscored verdicts or throttling; detection and false-positive rates are not quotable.';

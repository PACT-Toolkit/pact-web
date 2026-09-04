/** Options shared by {@link formatPercent} and {@link formatPercentValue}. */
export interface FormatPercentOptions {
  /** Decimal places to show. Defaults to 0 (whole percent). */
  digits?: number;
}

const PERCENT_PLACEHOLDER = 'n/a';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/**
 * Format a ratio in [0, 1] as a percent string, e.g. 0.418 -> "41.8%" with
 * `digits: 1`, or "42%" with the default `digits: 0`. This is the single
 * authority for percent-string rounding in pact-web - every component that
 * renders a ratio-shaped score, confidence, or rate as a percent should call
 * this instead of hand-rolling `(x * 100).toFixed(n)`.
 *
 * Values outside [0, 1] are not clamped - a ratio above 1 renders as a
 * percent above 100, which is the caller's bug to see, not this formatter's
 * to hide.
 *
 * `NaN`, `Infinity`, `null`, and `undefined` all render as "n/a".
 */
export function formatPercent(
  ratio: number | null | undefined,
  options: FormatPercentOptions = {}
): string {
  if (!isFiniteNumber(ratio)) return PERCENT_PLACEHOLDER;

  const digits = options.digits ?? 0;
  const rounded = (ratio * 100).toFixed(digits);
  // toFixed prepends "-" to values that round to zero from below (e.g.
  // (-0.001).toFixed(0) === "-0") - strip it so a near-zero negative ratio
  // never displays as "-0%".
  const normalized = Number(rounded) === 0 ? rounded.replace('-', '') : rounded;

  return `${normalized}%`;
}

/**
 * Format a value already expressed as a percent (0-100) - e.g. a backend
 * `block_rate` or `redaction_rate` field that arrives pre-multiplied - as a
 * percent string. Delegates to {@link formatPercent} for the actual
 * rounding so there is one authority for percent-string formatting; this
 * only handles the 0-100 vs 0-1 unit switch for the sites that hold a
 * percent rather than a ratio.
 */
export function formatPercentValue(
  percent: number | null | undefined,
  options: FormatPercentOptions = {}
): string {
  if (!isFiniteNumber(percent)) return PERCENT_PLACEHOLDER;

  return formatPercent(percent / 100, options);
}

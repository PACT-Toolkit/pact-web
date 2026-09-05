/**
 * Round a 0-1 fraction to a percent *number* with one decimal place, e.g.
 * 0.0523 -> 5.2. This is for chart data points that need a plottable number
 * (axis domain, bar value) rather than a display string - for a percent
 * *string* to render in prose, use `formatPercent` in `format_percent.ts`
 * instead. Single authority for this rounding so chart domains built from
 * different benchmark breakdowns (trend, per-category) stay consistent.
 */
export function roundToOneDecimalPercent(fraction: number): number {
  return Math.round(fraction * 1000) / 10;
}

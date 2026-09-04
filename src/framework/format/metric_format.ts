/** Unit family for a formatted metric value. */
export type MetricFormat = 'percent' | 'ms';

/** Format a raw metric value for display, rounded to one decimal place. */
export function formatMetric(value: number, format: MetricFormat): string {
  if (format === 'percent') return `${(value * 100).toFixed(1)}%`;

  return `${value.toFixed(1)} ms`;
}

/** Signed, human-readable delta. Percent metrics are shown in percentage points. */
export function formatDelta(delta: number, format: MetricFormat): string {
  const sign = delta > 0 ? '+' : '';
  if (format === 'percent') return `${sign}${(delta * 100).toFixed(1)} pp`;

  return `${sign}${delta.toFixed(1)} ms`;
}

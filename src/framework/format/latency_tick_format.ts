/**
 * Format a millisecond value as a rounded axis tick label, e.g. "1234 ms".
 * Shared by every chart that plots a latency value axis (the run-over-time
 * latency trend chart and the per-stage latency chart), so both use the same
 * rounding rule instead of drifting apart.
 */
export function formatLatencyTick(ms: number): string {
  return `${Math.round(ms)} ms`;
}

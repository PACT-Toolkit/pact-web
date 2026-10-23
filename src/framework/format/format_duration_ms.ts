/**
 * Format a duration given in milliseconds for display: one decimal below
 * 10 ms ("0.4 ms", "6.1 ms") so sub-millisecond stages stay visible, a whole
 * number from 10 ms upward ("277 ms", "1309 ms"). The cut-over uses the
 * value rounded to one decimal, so 9.96 prints "10 ms", never "10.0 ms".
 */
export function formatDurationMs(ms: number): string {
  const tenths = Math.round(ms * 10) / 10;

  return tenths < 10 ? `${tenths.toFixed(1)} ms` : `${Math.round(ms)} ms`;
}

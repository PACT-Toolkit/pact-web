/**
 * The one date + time label for a benchmark run, e.g. "5 Aug 2026, 14:32".
 * Shared by the run history, the comparison picker, the run rows header and
 * the chart tooltips so a run reads the same everywhere.
 *
 * Fixed to the en-GB locale, the viewer's local time zone, and minute
 * precision (24-hour clock, no seconds).
 */
export function formatRunTimestamp(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

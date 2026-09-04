/**
 * Format a Unix-seconds timestamp as a compact day tick label for a chart
 * x-axis, e.g. "5 Aug". Shared by every chart that plots a numeric,
 * day-granularity time axis (see `src/framework/charts/time_axis.ts`).
 */
export function formatDayTick(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleDateString('en-GB', {
    month: 'short',
    day: 'numeric',
  });
}

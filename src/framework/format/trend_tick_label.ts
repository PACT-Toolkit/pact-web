const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  day: 'numeric',
});

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function formatTimeLabel(date: Date): string {
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${hours}:${minutes}`;
}

function formatDayLabel(date: Date): string {
  return DAY_LABEL_FORMATTER.format(date);
}

/**
 * Build x-axis tick labels for a chronologically-ordered trend series
 * (ascending `ran_at` epoch seconds).
 *
 * When the whole series spans less than 24 hours, ticks are labeled with
 * local time (`HH:mm`) so same-day runs stay distinguishable. Otherwise
 * ticks are labeled with the day, and a label that repeats the immediately
 * preceding tick's day is suppressed (returned as an empty string) so two
 * runs on the same day don't render the same day label twice in a row.
 *
 * Assumes the input is sorted ascending, so comparing each label to its
 * immediate predecessor is equivalent to comparing it to the last
 * *displayed* day label.
 */
export function buildTrendTickLabels(
  timestampsSec: readonly number[]
): string[] {
  if (timestampsSec.length === 0) return [];

  const dates = timestampsSec.map((t) => new Date(t * 1000));
  const spanMs = dates[dates.length - 1].getTime() - dates[0].getTime();

  if (spanMs < MS_PER_DAY) {
    return dates.map(formatTimeLabel);
  }

  let previousDayLabel: string | null = null;

  return dates.map((date) => {
    const label = formatDayLabel(date);
    if (label === previousDayLabel) return '';
    previousDayLabel = label;

    return label;
  });
}

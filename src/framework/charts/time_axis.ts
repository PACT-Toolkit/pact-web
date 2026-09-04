/** Seconds in a day / half-day, used to pad and bucket a Unix-seconds time axis. */
const DAY_SECONDS = 86400;
const HALF_DAY_SECONDS = DAY_SECONDS / 2;

/** Ticks are capped to roughly this many so labels never overlap on a long range. */
const MAX_TICKS = 8;

/** A numeric time-axis domain and its day-boundary tick positions, both in Unix seconds. */
export interface TimeAxisScale {
  domain: [number, number];
  ticks: number[];
}

/** Local midnight (00:00:00) of the day containing `unixSeconds`, in Unix seconds. */
function localMidnight(unixSeconds: number): number {
  const date = new Date(unixSeconds * 1000);
  date.setHours(0, 0, 0, 0);

  return Math.floor(date.getTime() / 1000);
}

/**
 * Compute a numeric time-axis domain and day tick marks for a recharts
 * `<XAxis type="number" scale="time">` from a set of run timestamps.
 *
 * The domain pads 12h on each side so the first/last point never sits
 * exactly on the plot edge, then reduces to the pair of local-midnight day
 * boundaries the padded domain falls within - a single point (or several
 * points on the same day) still yields a real 1-day-wide window rather than
 * a zero-width domain. Ticks land on local midnight for each day in that
 * range, stepping by more than one day when the range is long enough that a
 * tick per day would exceed `MAX_TICKS`.
 */
export function computeTimeAxisScale(
  timestampsUnixSeconds: readonly number[]
): TimeAxisScale {
  if (timestampsUnixSeconds.length === 0) {
    const today = localMidnight(Math.floor(Date.now() / 1000));

    return {
      domain: [today - HALF_DAY_SECONDS, today + HALF_DAY_SECONDS],
      ticks: [today],
    };
  }

  const min = Math.min(...timestampsUnixSeconds);
  const max = Math.max(...timestampsUnixSeconds);
  const domain: [number, number] = [
    min - HALF_DAY_SECONDS,
    max + HALF_DAY_SECONDS,
  ];

  const firstDay = localMidnight(domain[0]);
  const lastDay = localMidnight(domain[1]);
  const spanDays = Math.round((lastDay - firstDay) / DAY_SECONDS) + 1;
  const stepDays = Math.max(1, Math.ceil(spanDays / MAX_TICKS));

  const ticks: number[] = [];
  for (let day = firstDay; day <= lastDay; day += stepDays * DAY_SECONDS) {
    ticks.push(day);
  }
  if (ticks[ticks.length - 1] !== lastDay) ticks.push(lastDay);

  return { domain, ticks };
}

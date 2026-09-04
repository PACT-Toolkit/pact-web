import { describe, expect, it } from 'vitest';

import { buildTrendTickLabels } from '@/src/framework/format/trend_tick_label';

/** Epoch seconds for a local wall-clock time, avoiding UTC/local drift in assertions. */
const localEpochSec = (
  year: number,
  monthIndex: number,
  day: number,
  hours = 0,
  minutes = 0
): number => new Date(year, monthIndex, day, hours, minutes).getTime() / 1000;

describe('buildTrendTickLabels', () => {
  it('returns an empty array for an empty series', () => {
    expect(buildTrendTickLabels([])).toEqual([]);
  });

  it('labels with time when the whole series spans less than 24 hours', () => {
    const base = localEpochSec(2026, 7, 5, 9, 0);
    const timestamps = [base, base + 3600, base + 7200];

    const labels = buildTrendTickLabels(timestamps);

    expect(labels).toEqual(['09:00', '10:00', '11:00']);
  });

  it('labels with the day and suppresses a repeated day when the series spans 24h or more', () => {
    const day1 = localEpochSec(2026, 7, 5, 8, 0);
    const day1Later = localEpochSec(2026, 7, 5, 20, 0);
    const day2 = localEpochSec(2026, 7, 6, 9, 0);

    const labels = buildTrendTickLabels([day1, day1Later, day2]);

    expect(labels).toEqual(['5 Aug', '', '6 Aug']);
  });

  it('treats a single-point series as a zero-span (time-labeled) series', () => {
    const day1 = localEpochSec(2026, 7, 5, 8, 0);

    const labels = buildTrendTickLabels([day1]);

    expect(labels).toEqual(['08:00']);
  });

  it('shows every day label when no two consecutive runs share a day', () => {
    const day1 = localEpochSec(2026, 7, 5, 8, 0);
    const day2 = localEpochSec(2026, 7, 6, 8, 0);
    const day3 = localEpochSec(2026, 7, 7, 8, 0);

    const labels = buildTrendTickLabels([day1, day2, day3]);

    expect(labels).toEqual(['5 Aug', '6 Aug', '7 Aug']);
  });
});

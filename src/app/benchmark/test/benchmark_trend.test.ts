import { describe, expect, it } from 'vitest';

import {
  sinceUnixFromRange,
  TREND_DATE_RANGES,
} from '@/src/app/benchmark/domain/benchmark_run';

describe('sinceUnixFromRange', () => {
  const now = Math.floor(Date.now() / 1000);

  it('returns 0 for "all"', () => {
    expect(sinceUnixFromRange('all')).toBe(0);
  });

  it('returns approx 7 days ago for "7d"', () => {
    const since = sinceUnixFromRange('7d');
    expect(since).toBeGreaterThan(now - 7 * 86400 - 5);
    expect(since).toBeLessThanOrEqual(now - 7 * 86400 + 5);
  });

  it('returns approx 30 days ago for "30d"', () => {
    const since = sinceUnixFromRange('30d');
    expect(since).toBeGreaterThan(now - 30 * 86400 - 5);
    expect(since).toBeLessThanOrEqual(now - 30 * 86400 + 5);
  });

  it('returns approx 90 days ago for "90d"', () => {
    const since = sinceUnixFromRange('90d');
    expect(since).toBeGreaterThan(now - 90 * 86400 - 5);
    expect(since).toBeLessThanOrEqual(now - 90 * 86400 + 5);
  });
});

describe('TREND_DATE_RANGES', () => {
  it('includes all four options in order', () => {
    expect(TREND_DATE_RANGES.map((r) => r.value)).toEqual([
      '7d',
      '30d',
      '90d',
      'all',
    ]);
  });
});

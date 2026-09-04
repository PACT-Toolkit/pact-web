import { describe, expect, it } from 'vitest';

import { computeTimeAxisScale } from '@/src/framework/charts/time_axis';

// TZ is pinned to CET in vitest.config.ts, and January dates keep every
// case outside CEST (UTC+2) so the day-boundary math below is exercised
// against a single, predictable UTC+1 offset.
const JAN_5_NOON = Date.UTC(2026, 0, 5, 11, 0, 0) / 1000; // 12:00 CET
const JAN_5_MIDNIGHT_CET = Date.UTC(2026, 0, 4, 23, 0, 0) / 1000; // 00:00 CET on Jan 5
const JAN_6_MIDNIGHT_CET = Date.UTC(2026, 0, 5, 23, 0, 0) / 1000; // 00:00 CET on Jan 6

describe('computeTimeAxisScale', () => {
  it('returns a non-empty domain and at least one tick for an empty input', () => {
    const scale = computeTimeAxisScale([]);

    expect(scale.domain[1]).toBeGreaterThan(scale.domain[0]);
    expect(scale.ticks.length).toBeGreaterThan(0);
  });

  it('brackets a single point in a 1-day window with two midnight ticks', () => {
    const scale = computeTimeAxisScale([JAN_5_NOON]);

    expect(scale.domain[0]).toBeLessThan(JAN_5_NOON);
    expect(scale.domain[1]).toBeGreaterThan(JAN_5_NOON);
    expect(scale.ticks).toEqual([JAN_5_MIDNIGHT_CET, JAN_6_MIDNIGHT_CET]);
  });

  it('brackets several same-day points in a small window of day ticks', () => {
    const morning = JAN_5_NOON - 1 * 3600;
    const evening = JAN_5_NOON + 1 * 3600;
    const scale = computeTimeAxisScale([morning, JAN_5_NOON, evening]);

    expect(scale.domain[0]).toBeLessThan(morning);
    expect(scale.domain[1]).toBeGreaterThan(evening);
    expect(scale.ticks).toContain(JAN_5_MIDNIGHT_CET);
    expect(scale.ticks.length).toBeLessThanOrEqual(3);
  });

  it('spans the padded domain across the min and max points', () => {
    const start = JAN_5_NOON;
    const end = start + 10 * 86400;
    const scale = computeTimeAxisScale([start, end]);

    expect(scale.domain[0]).toBeLessThan(start);
    expect(scale.domain[1]).toBeGreaterThan(end);
  });

  it('caps ticks to roughly 8 for a multi-week span', () => {
    const start = JAN_5_NOON;
    const points = Array.from({ length: 60 }, (_, i) => start + i * 86400);
    const scale = computeTimeAxisScale(points);

    expect(scale.ticks.length).toBeLessThanOrEqual(9);
    expect(scale.ticks.length).toBeGreaterThan(1);
  });

  it('keeps the last tick within a day of the domain end for a long span', () => {
    const start = JAN_5_NOON;
    const points = Array.from({ length: 60 }, (_, i) => start + i * 86400);
    const scale = computeTimeAxisScale(points);
    const lastTick = scale.ticks[scale.ticks.length - 1];

    expect(scale.domain[1] - lastTick).toBeLessThanOrEqual(86400);
  });

  it('produces ticks in strictly ascending order', () => {
    const start = JAN_5_NOON;
    const points = Array.from({ length: 25 }, (_, i) => start + i * 86400);
    const scale = computeTimeAxisScale(points);

    for (let i = 1; i < scale.ticks.length; i++) {
      expect(scale.ticks[i]).toBeGreaterThan(scale.ticks[i - 1]);
    }
  });
});

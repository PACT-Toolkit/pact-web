import { describe, expect, it } from 'vitest';

import { formatDayTick } from '@/src/framework/format/day_tick_format';

// TZ is pinned to CET in vitest.config.ts (see vitest.config.ts's comment).
describe('formatDayTick', () => {
  it('formats a Unix timestamp as "<day> <short month>"', () => {
    const aug5NoonUtc = Date.UTC(2026, 7, 5, 12, 0, 0) / 1000;

    expect(formatDayTick(aug5NoonUtc)).toBe('5 Aug');
  });

  it('formats a single-digit day without leading zero', () => {
    const jan1NoonUtc = Date.UTC(2026, 0, 1, 12, 0, 0) / 1000;

    expect(formatDayTick(jan1NoonUtc)).toBe('1 Jan');
  });

  it('formats a double-digit day', () => {
    const dec25NoonUtc = Date.UTC(2026, 11, 25, 12, 0, 0) / 1000;

    expect(formatDayTick(dec25NoonUtc)).toBe('25 Dec');
  });
});

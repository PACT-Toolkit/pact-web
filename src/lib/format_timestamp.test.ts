import { describe, expect, it } from 'vitest';

import { formatTimestamp } from './format_timestamp';

describe('formatTimestamp', () => {
  // 2026-01-15T10:00:00Z falls in CET's winter (standard, UTC+1) offset, so
  // the wall-clock hour rendered here is 11, not the UTC hour of 10. This
  // pins vitest.config.ts's `test.env.TZ = 'CET'` setting: if
  // that pin stopped applying (e.g. reverted to a shell-only prefix that
  // cmd.exe cannot parse), the formatter would render the UTC hour instead
  // and this would fail. Matches on the HH:MM:SS fragment rather than the
  // full string so the assertion stays agnostic to locale formatting
  // details (12h/24h, month-day ordering) that can vary across Node/ICU
  // versions.
  it('renders the ISO timestamp using the CET wall-clock hour, not UTC', () => {
    const result = formatTimestamp('2026-01-15T10:00:00.000Z');

    expect(result).toMatch(/\b11:00:00\b/);
    expect(result).not.toMatch(/\b10:00:00\b/);
  });

  it('formats a Date like the equivalent ISO string', () => {
    const iso = '2026-01-15T10:00:00.000Z';

    expect(formatTimestamp(new Date(iso), 'compact')).toBe(
      formatTimestamp(iso, 'compact')
    );
  });

  it('falls back to the raw string for an unparseable string', () => {
    expect(formatTimestamp('not a date')).toBe('not a date');
  });

  it('returns an empty string for an invalid Date', () => {
    expect(formatTimestamp(new Date(Number.NaN))).toBe('');
  });

  it('the date variant renders the day without a time', () => {
    const result = formatTimestamp('2026-01-15T10:00:00.000Z', 'date');

    expect(result).toContain('2026');
    expect(result).not.toMatch(/\d:\d/);
  });

  it('the dateTime variant renders the CET wall clock without seconds', () => {
    expect(formatTimestamp('2026-01-15T10:00:00.000Z', 'dateTime')).toMatch(
      /\b11:00\b(?!:)/
    );
  });

  it('the time variant renders the CET wall clock with seconds', () => {
    expect(formatTimestamp('2026-01-15T10:00:00.000Z', 'time')).toMatch(
      /\b11:00:00\b/
    );
  });
});

import { describe, expect, it } from 'vitest';

import { formatRunTimestamp } from '@/src/framework/format/run_timestamp';

// TZ is pinned to CET in vitest.config.ts, so the local-time output is fixed.
describe('formatRunTimestamp', () => {
  it('formats a summer instant as day, short month, year and CEST time', () => {
    const unixSeconds = Date.UTC(2026, 7, 5, 12, 32, 0) / 1000;

    expect(formatRunTimestamp(unixSeconds)).toBe('5 Aug 2026, 14:32');
  });

  it('formats a winter instant on the CET clock', () => {
    expect(formatRunTimestamp(1_700_000_000)).toBe('14 Nov 2023, 23:13');
  });

  it('uses a 24-hour clock with a zero-padded hour and no seconds', () => {
    const unixSeconds = Date.UTC(2026, 0, 2, 3, 4, 59) / 1000;

    expect(formatRunTimestamp(unixSeconds)).toBe('2 Jan 2026, 04:04');
  });

  it('rolls over to the next local day past midnight CET', () => {
    const unixSeconds = Date.UTC(2026, 0, 31, 23, 30, 0) / 1000;

    expect(formatRunTimestamp(unixSeconds)).toBe('1 Feb 2026, 00:30');
  });

  it('renders the epoch start as a valid label', () => {
    expect(formatRunTimestamp(0)).toBe('1 Jan 1970, 01:00');
  });
});

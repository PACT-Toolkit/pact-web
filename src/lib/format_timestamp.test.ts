import { describe, expect, it } from 'vitest';

import { formatTimestamp } from './format_timestamp';

describe('formatTimestamp', () => {
  // 2026-01-15T10:00:00Z falls in CET's winter (standard, UTC+1) offset, so
  // the wall-clock hour rendered here is 11, not the UTC hour of 10. This
  // pins vitest.config.ts's `test.env.TZ = 'CET'` setting (PACT-763): if
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
});

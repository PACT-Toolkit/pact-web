import { describe, expect, it } from 'vitest';

import { formatDurationMs } from '@/src/framework/format/format_duration_ms';

describe('formatDurationMs', () => {
  it.each([
    [0.04, '0.0 ms'],
    [0.4, '0.4 ms'],
    [6.1, '6.1 ms'],
    [9.94, '9.9 ms'],
    [9.95, '10 ms'],
    [10, '10 ms'],
    [276.6, '277 ms'],
    [1309.387, '1309 ms'],
  ])('formats %s as %s', (ms, expected) => {
    expect(formatDurationMs(ms)).toBe(expected);
  });
});

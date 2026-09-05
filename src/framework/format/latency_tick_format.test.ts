import { describe, expect, it } from 'vitest';

import { formatLatencyTick } from '@/src/framework/format/latency_tick_format';

describe('formatLatencyTick', () => {
  it('rounds to the nearest millisecond', () => {
    expect(formatLatencyTick(123.4)).toBe('123 ms');
    expect(formatLatencyTick(123.6)).toBe('124 ms');
  });

  it('formats zero', () => {
    expect(formatLatencyTick(0)).toBe('0 ms');
  });

  it('formats a large value without a thousands separator', () => {
    expect(formatLatencyTick(2500)).toBe('2500 ms');
  });
});

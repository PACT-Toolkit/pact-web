import { describe, expect, it } from 'vitest';

import { stageDurationMs } from '@/src/framework/decisions/stage_duration';

describe('stageDurationMs', () => {
  it('converts duration_us to fractional milliseconds', () => {
    expect(stageDurationMs({ duration_us: 400 })).toBe(0.4);
    expect(stageDurationMs({ duration_us: 1_309_387 })).toBe(1309.387);
  });

  it('prefers duration_us over duration_ms', () => {
    expect(stageDurationMs({ duration_ms: 2, duration_us: 2154 })).toBe(2.154);
  });

  it('falls back to duration_ms only when duration_us is absent', () => {
    expect(stageDurationMs({ duration_ms: 3 })).toBe(3);
    expect(stageDurationMs({ duration_ms: 9, duration_us: 0 })).toBeUndefined();
  });

  it.each([
    [undefined],
    [{}],
    [{ duration_us: 0 }],
    [{ duration_ms: -2 }],
    [{ duration_ms: Number.NaN }],
    [{ duration_ms: '6' as unknown as number }],
  ])('returns undefined when there is no usable timing (%j)', (timing) => {
    expect(stageDurationMs(timing)).toBeUndefined();
  });
});

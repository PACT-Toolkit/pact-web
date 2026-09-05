import { describe, expect, it } from 'vitest';

import { roundToOneDecimalPercent } from '@/src/framework/format/round_percent';

describe('roundToOneDecimalPercent', () => {
  it('rounds a mid-range fraction to one decimal percent', () => {
    expect(roundToOneDecimalPercent(0.0523)).toBe(5.2);
  });

  it('returns 0 for a zero fraction', () => {
    expect(roundToOneDecimalPercent(0)).toBe(0);
  });

  it('returns 100 for a fraction of 1', () => {
    expect(roundToOneDecimalPercent(1)).toBe(100);
  });

  it('rounds down when the second decimal is below 5', () => {
    expect(roundToOneDecimalPercent(0.90449)).toBe(90.4);
  });

  it('rounds up when the second decimal is 5 or above', () => {
    expect(roundToOneDecimalPercent(0.9045)).toBe(90.5);
  });
});

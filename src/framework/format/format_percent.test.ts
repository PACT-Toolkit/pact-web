import { describe, expect, it } from 'vitest';

import {
  formatPercent,
  formatPercentValue,
} from '@/src/framework/format/format_percent';

describe('formatPercent', () => {
  it('formats whole ratios at the default precision', () => {
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0.5)).toBe('50%');
  });

  it('rounds to the requested number of digits', () => {
    expect(formatPercent(0.418, { digits: 0 })).toBe('42%');
    expect(formatPercent(0.418, { digits: 1 })).toBe('41.8%');
  });

  it('does not clamp ratios above 1', () => {
    expect(formatPercent(1.5)).toBe('150%');
  });

  it('never renders "-0%" for a ratio that rounds to zero from below', () => {
    expect(formatPercent(-0)).toBe('0%');
    expect(formatPercent(-0.0001, { digits: 0 })).toBe('0%');
  });

  it('renders "n/a" for non-finite or missing input', () => {
    expect(formatPercent(NaN)).toBe('n/a');
    expect(formatPercent(Infinity)).toBe('n/a');
    expect(formatPercent(undefined)).toBe('n/a');
    expect(formatPercent(null)).toBe('n/a');
  });
});

describe('formatPercentValue', () => {
  it('formats a value already expressed as a percent (0-100)', () => {
    expect(formatPercentValue(41.8, { digits: 0 })).toBe('42%');
    expect(formatPercentValue(41.8, { digits: 1 })).toBe('41.8%');
    expect(formatPercentValue(100)).toBe('100%');
  });

  it('renders "n/a" for non-finite or missing input', () => {
    expect(formatPercentValue(NaN)).toBe('n/a');
    expect(formatPercentValue(undefined)).toBe('n/a');
    expect(formatPercentValue(null)).toBe('n/a');
  });
});

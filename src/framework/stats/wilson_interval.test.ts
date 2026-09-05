import { describe, expect, it } from 'vitest';

import {
  wilsonInterval,
  wilsonIntervalForCounts,
} from '@/src/framework/stats/wilson_interval';

describe('wilsonInterval', () => {
  it('returns a zero-width interval at zero when trials is 0', () => {
    expect(wilsonInterval(5, 0)).toEqual({ low: 0, high: 0 });
  });

  it('returns a zero-width interval at zero for a negative trial count', () => {
    expect(wilsonInterval(0, -1)).toEqual({ low: 0, high: 0 });
  });

  it('bounds a 0% observed rate away from a negative lower bound', () => {
    const { low, high } = wilsonInterval(0, 10);
    expect(low).toBe(0);
    expect(high).toBeCloseTo(0.2775328, 5);
  });

  it('bounds a 100% observed rate at or below 1', () => {
    const { low, high } = wilsonInterval(10, 10);
    expect(low).toBeCloseTo(0.7224672, 5);
    expect(high).toBeLessThanOrEqual(1);
    expect(high).toBeCloseTo(1, 5);
  });

  it('matches a hand-computed interval for a mid-range proportion', () => {
    const { low, high } = wilsonInterval(95, 100);
    expect(low).toBeCloseTo(0.8882495, 5);
    expect(high).toBeCloseTo(0.9784563, 5);
  });

  it('is symmetric around 50% for an even split', () => {
    const { low, high } = wilsonInterval(50, 100);
    expect(low).toBeCloseTo(0.4038315, 5);
    expect(high).toBeCloseTo(0.5961685, 5);
    expect(low + high).toBeCloseTo(1, 5);
  });
});

describe('wilsonIntervalForCounts', () => {
  it('returns undefined when successes is undefined', () => {
    expect(wilsonIntervalForCounts(undefined, 100)).toBeUndefined();
  });

  it('returns undefined when trials is undefined', () => {
    expect(wilsonIntervalForCounts(10, undefined)).toBeUndefined();
  });

  it('returns undefined when both are undefined', () => {
    expect(wilsonIntervalForCounts(undefined, undefined)).toBeUndefined();
  });

  it('delegates to wilsonInterval when both are defined', () => {
    expect(wilsonIntervalForCounts(95, 100)).toEqual(wilsonInterval(95, 100));
  });
});

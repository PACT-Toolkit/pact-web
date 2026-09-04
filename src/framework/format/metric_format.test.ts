import { describe, expect, it } from 'vitest';

import {
  formatDelta,
  formatMetric,
} from '@/src/framework/format/metric_format';

describe('formatMetric', () => {
  it('formats percent metrics', () => {
    expect(formatMetric(0.834, 'percent')).toBe('83.4%');
  });

  it('formats latency in ms', () => {
    expect(formatMetric(12.34, 'ms')).toBe('12.3 ms');
  });

  it('rounds a long float latency to one decimal', () => {
    expect(formatMetric(426.9324999768287, 'ms')).toBe('426.9 ms');
  });
});

describe('formatDelta', () => {
  it('shows percentage points with a sign', () => {
    expect(formatDelta(0.1, 'percent')).toBe('+10.0 pp');
    expect(formatDelta(-0.02, 'percent')).toBe('-2.0 pp');
  });

  it('shows ms deltas with a sign', () => {
    expect(formatDelta(2, 'ms')).toBe('+2.0 ms');
    expect(formatDelta(-10, 'ms')).toBe('-10.0 ms');
  });
});

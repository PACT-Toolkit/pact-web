import { describe, expect, it } from 'vitest';

import {
  sinceUnixFromRange,
  TREND_DATE_RANGES,
  type BenchmarkRun,
} from '@/src/app/benchmark/domain/benchmark_run';
import {
  formatConfidenceBand,
  formatRunTimestamp,
  latencyChartData,
  LATENCY_SERIES,
  trendChartData,
  TREND_SERIES,
} from '@/src/app/benchmark/domain/benchmark_trend';

describe('sinceUnixFromRange', () => {
  const now = Math.floor(Date.now() / 1000);

  it('returns 0 for "all"', () => {
    expect(sinceUnixFromRange('all')).toBe(0);
  });

  it('returns approx 7 days ago for "7d"', () => {
    const since = sinceUnixFromRange('7d');
    expect(since).toBeGreaterThan(now - 7 * 86400 - 5);
    expect(since).toBeLessThanOrEqual(now - 7 * 86400 + 5);
  });

  it('returns approx 30 days ago for "30d"', () => {
    const since = sinceUnixFromRange('30d');
    expect(since).toBeGreaterThan(now - 30 * 86400 - 5);
    expect(since).toBeLessThanOrEqual(now - 30 * 86400 + 5);
  });

  it('returns approx 90 days ago for "90d"', () => {
    const since = sinceUnixFromRange('90d');
    expect(since).toBeGreaterThan(now - 90 * 86400 - 5);
    expect(since).toBeLessThanOrEqual(now - 90 * 86400 + 5);
  });
});

describe('TREND_DATE_RANGES', () => {
  it('includes all four options in order', () => {
    expect(TREND_DATE_RANGES.map((r) => r.value)).toEqual([
      '7d',
      '30d',
      '90d',
      'all',
    ]);
  });
});

function makeRun(overrides: Partial<BenchmarkRun>): BenchmarkRun {
  return {
    id: 'run-1',
    gateway_version: 'v1.0.0',
    engine: 'deberta',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.953,
    fp_rate: 0.052,
    p50_latency: 20,
    p99_latency: 100,
    row_count: 200,
    ran_at: 1_700_000_000,
    ...overrides,
  };
}

describe('TREND_SERIES', () => {
  it('uses a plain --chart-N custom property for every series color', () => {
    for (const entry of Object.values(TREND_SERIES)) {
      expect(entry.color).toMatch(/^var\(--chart-\d\)$/);
    }
  });

  it('defines exactly the detection_rate and fp_rate series', () => {
    expect(Object.keys(TREND_SERIES).sort()).toEqual([
      'detection_rate',
      'fp_rate',
    ]);
  });
});

describe('trendChartData', () => {
  it('returns an empty array for no runs', () => {
    expect(trendChartData([])).toEqual([]);
  });

  it('sorts ascending by ran_at regardless of input order', () => {
    const older = makeRun({ id: 'run-a', ran_at: 100 });
    const newer = makeRun({ id: 'run-b', ran_at: 200 });

    const result = trendChartData([newer, older]);

    expect(result.map((p) => p.ran_at)).toEqual([100, 200]);
  });

  it('rounds detection_rate and fp_rate to a percent with one decimal', () => {
    const run = makeRun({ detection_rate: 0.9531, fp_rate: 0.0524 });

    const [point] = trendChartData([run]);

    expect(point.detection_rate).toBeCloseTo(95.3, 5);
    expect(point.fp_rate).toBeCloseTo(5.2, 5);
  });

  it('carries row_count, corpus_version, engine, and gateway_version through', () => {
    const run = makeRun({
      row_count: 321,
      corpus_version: 'seed-v9.jsonl',
      engine: 'stub',
      gateway_version: 'v2.1.0',
    });

    const [point] = trendChartData([run]);

    expect(point.row_count).toBe(321);
    expect(point.corpus_version).toBe('seed-v9.jsonl');
    expect(point.engine).toBe('stub');
    expect(point.gateway_version).toBe('v2.1.0');
  });

  it('leaves detection_band and fp_band undefined when the run has no counts', () => {
    const run = makeRun({ counts: undefined });

    const [point] = trendChartData([run]);

    expect(point.detection_band).toBeUndefined();
    expect(point.fp_band).toBeUndefined();
  });

  it('computes a Wilson confidence band from counts when present', () => {
    const run = makeRun({
      counts: {
        attacks: 100,
        benign: 100,
        true_positives: 95,
        false_positives: 5,
        errors: 0,
      },
    });

    const [point] = trendChartData([run]);

    expect(point.detection_band).toEqual([88.8, 97.8]);
    expect(point.fp_band).toEqual([2.2, 11.2]);
  });
});

describe('formatConfidenceBand', () => {
  it('returns null when the band is absent', () => {
    expect(formatConfidenceBand(undefined)).toBeNull();
  });

  it('renders a "low%-high%" string', () => {
    expect(formatConfidenceBand([88.8, 97.8])).toBe('88.8%-97.8%');
  });
});

describe('LATENCY_SERIES', () => {
  it('uses a plain --chart-N custom property for every series color', () => {
    for (const entry of Object.values(LATENCY_SERIES)) {
      expect(entry.color).toMatch(/^var\(--chart-\d\)$/);
    }
  });

  it('defines exactly the p50_latency and p99_latency series', () => {
    expect(Object.keys(LATENCY_SERIES).sort()).toEqual([
      'p50_latency',
      'p99_latency',
    ]);
  });

  it('uses different colors than TREND_SERIES', () => {
    const trendColors = new Set(
      Object.values(TREND_SERIES).map((s) => s.color)
    );
    for (const entry of Object.values(LATENCY_SERIES)) {
      expect(trendColors.has(entry.color)).toBe(false);
    }
  });
});

describe('latencyChartData', () => {
  it('returns an empty array for no runs', () => {
    expect(latencyChartData([])).toEqual([]);
  });

  it('sorts ascending by ran_at regardless of input order', () => {
    const older = makeRun({ id: 'run-a', ran_at: 100 });
    const newer = makeRun({ id: 'run-b', ran_at: 200 });

    const result = latencyChartData([newer, older]);

    expect(result.map((p) => p.ran_at)).toEqual([100, 200]);
  });

  it('carries p50_latency and p99_latency through unrounded', () => {
    const run = makeRun({ p50_latency: 258.4, p99_latency: 541.9 });

    const [point] = latencyChartData([run]);

    expect(point.p50_latency).toBe(258.4);
    expect(point.p99_latency).toBe(541.9);
  });

  it('carries row_count, corpus_version, engine, and gateway_version through', () => {
    const run = makeRun({
      row_count: 321,
      corpus_version: 'seed-v9.jsonl',
      engine: 'stub',
      gateway_version: 'v2.1.0',
    });

    const [point] = latencyChartData([run]);

    expect(point.row_count).toBe(321);
    expect(point.corpus_version).toBe('seed-v9.jsonl');
    expect(point.engine).toBe('stub');
    expect(point.gateway_version).toBe('v2.1.0');
  });
});

describe('formatRunTimestamp', () => {
  it('formats a Unix timestamp as a full date and time', () => {
    // 5 Aug 2026, 14:32 CET (TZ pinned in vitest.config.ts).
    const unixSeconds = Date.UTC(2026, 7, 5, 12, 32, 0) / 1000;

    const label = formatRunTimestamp(unixSeconds);

    expect(label).toContain('2026');
    expect(label).toContain('Aug');
    expect(label).toContain('14:32');
  });
});

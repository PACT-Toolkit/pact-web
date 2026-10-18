import { describe, expect, it } from 'vitest';

import { type JobResult } from '@/src/app/benchmark/domain/benchmark_job';
import { jobHeadlineStats } from '@/src/app/benchmark/domain/benchmark_job_summary';

const makeResult = (overrides: Partial<JobResult> = {}): JobResult => ({
  detection_rate: 0.93,
  fp_rate: 0.04,
  p50_latency_ms: 12.34,
  p99_latency_ms: 120.06,
  rows: [],
  total_rows: 200,
  ...overrides,
});

describe('jobHeadlineStats', () => {
  it('lists the two rates then the two latencies, formatted to one decimal', () => {
    expect(jobHeadlineStats(makeResult())).toEqual([
      { key: 'detection_rate', label: 'Detection rate', value: '93.0%' },
      { key: 'fp_rate', label: 'False-positive rate', value: '4.0%' },
      { key: 'p50_latency', label: 'p50 latency', value: '12.3 ms' },
      { key: 'p99_latency', label: 'p99 latency', value: '120.1 ms' },
    ]);
  });

  it('formats an all-zero result without NaN or blanks', () => {
    const stats = jobHeadlineStats(
      makeResult({
        detection_rate: 0,
        fp_rate: 0,
        p50_latency_ms: 0,
        p99_latency_ms: 0,
        total_rows: 0,
      })
    );

    expect(stats.map((s) => s.value)).toEqual([
      '0.0%',
      '0.0%',
      '0.0 ms',
      '0.0 ms',
    ]);
  });
});

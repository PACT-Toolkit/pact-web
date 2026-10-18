import { type JobResult } from '@/src/app/benchmark/domain/benchmark_job';
import { formatMetric } from '@/src/framework/format/metric_format';

/** One headline figure of a finished job: a rate or a latency percentile. */
export interface JobHeadlineStat {
  key: 'detection_rate' | 'fp_rate' | 'p50_latency' | 'p99_latency';
  label: string;
  /** Display-ready value, rounded to one decimal place with its unit. */
  value: string;
}

/**
 * The four headline figures of a finished job, in display order: the two
 * rates, then the two latency percentiles. The rates are the gateway's own
 * and already exclude unscored rows (see benchmark_confusion.ts), so they are
 * formatted as reported, never recomputed from the counts.
 */
export function jobHeadlineStats(result: JobResult): JobHeadlineStat[] {
  return [
    {
      key: 'detection_rate',
      label: 'Detection rate',
      value: formatMetric(result.detection_rate, 'percent'),
    },
    {
      key: 'fp_rate',
      label: 'False-positive rate',
      value: formatMetric(result.fp_rate, 'percent'),
    },
    {
      key: 'p50_latency',
      label: 'p50 latency',
      value: formatMetric(result.p50_latency_ms, 'ms'),
    },
    {
      key: 'p99_latency',
      label: 'p99 latency',
      value: formatMetric(result.p99_latency_ms, 'ms'),
    },
  ];
}

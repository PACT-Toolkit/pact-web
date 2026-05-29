export interface BenchmarkRun {
  id: string;
  gateway_version: string;
  engine: string;
  corpus_version: string;
  detection_rate: number; // 0–1
  fp_rate: number; // 0–1
  p50_latency: number; // ms
  p99_latency: number; // ms
  row_count: number;
  ran_at: number; // Unix seconds (UTC)
}

export interface BenchmarkRunsResponse {
  runs: BenchmarkRun[];
  total: number;
}

/** Date-range presets for the trend chart filter. */
export type TrendDateRange = '7d' | '30d' | '90d' | 'all';

export const TREND_DATE_RANGES: { label: string; value: TrendDateRange }[] = [
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
  { label: '90d', value: '90d' },
  { label: 'All', value: 'all' },
];

/** Convert a TrendDateRange to a Unix timestamp cutoff (seconds). 0 = no lower bound. */
export function sinceUnixFromRange(range: TrendDateRange): number {
  if (range === 'all') return 0;
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;

  return Math.floor(Date.now() / 1000) - days * 86400;
}

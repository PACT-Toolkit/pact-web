// Benchmark run wire types are generated from the gateway's per-tag swagger
// slice (schema/benchmark, pulled from pact-gateway). The generated names carry
// the Go package + struct prefix; alias them to the domain vocabulary so the
// rest of the feature imports stable run types from the domain layer, not the
// codegen folder.
export type {
  BenchmarkBenchmarkRunBody as BenchmarkRun,
  BenchmarkListRunsResponse as BenchmarkRunsResponse,
} from '@/src/__codegen__/rest/benchmark';

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

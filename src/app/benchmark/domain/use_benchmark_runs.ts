import { useMemo } from 'react';

import { useListBenchmarkRuns } from '@/src/__codegen__/rest/benchmark';
import {
  type BenchmarkRun,
  type TrendDateRange,
  sinceUnixFromRange,
} from '@/src/app/benchmark/domain/benchmark_run';

const RUNS_LIMIT = 200;

export function useBenchmarkRuns(dateRange: TrendDateRange) {
  // Memoize on dateRange so the moving since_unix cutoff is computed once per
  // range change, keeping the SWR key (and thus the request) stable between
  // renders instead of refetching on every tick.
  const params = useMemo(() => {
    const since = sinceUnixFromRange(dateRange);

    return since > 0
      ? { limit: RUNS_LIMIT, since_unix: since }
      : { limit: RUNS_LIMIT };
  }, [dateRange]);

  const { data, error, isLoading, isValidating } = useListBenchmarkRuns(
    params,
    { swr: { revalidateOnFocus: false } }
  );

  const runs = useMemo<BenchmarkRun[]>(
    () =>
      // Sort ascending by ran_at so the chart plots left-to-right chronologically.
      // runs may be absent when a 200 body parses to {} (generated fetcher default).
      data?.status === 200
        ? [...(data.data.runs ?? [])].sort((a, b) => a.ran_at - b.ran_at)
        : [],
    [data]
  );

  // The generated fetcher resolves its promise for every HTTP status, so a
  // non-200 (401/5xx) would otherwise read as "no runs" rather than a failure.
  // Surface it as an error so the trend chart can show its failure state.
  const httpError =
    data && data.status !== 200
      ? new Error(`benchmark runs request failed (${data.status})`)
      : undefined;

  return {
    runs,
    total: data?.status === 200 ? (data.data.total ?? 0) : 0,
    isLoading: isLoading || isValidating,
    error: error ?? httpError,
  };
}

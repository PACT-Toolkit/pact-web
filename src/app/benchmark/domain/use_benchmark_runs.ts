import { useMemo } from 'react';
import useSWR from 'swr';

import {
  type BenchmarkRunsResponse,
  type TrendDateRange,
  sinceUnixFromRange,
} from '@/src/app/benchmark/domain/benchmark_run';
import { httpClient } from '@/src/framework/http';

const RUNS_LIMIT = 200;

const fetchRuns = (url: string) =>
  httpClient.get<BenchmarkRunsResponse>(url).then((r) => r.data);

export function useBenchmarkRuns(dateRange: TrendDateRange) {
  const key = useMemo(() => {
    const since = sinceUnixFromRange(dateRange);
    const params = new URLSearchParams({ limit: String(RUNS_LIMIT) });
    if (since > 0) params.set('since_unix', String(since));

    return `/api/pact/benchmark/v1/runs?${params.toString()}`;
  }, [dateRange]);

  const { data, error, isLoading, isValidating } =
    useSWR<BenchmarkRunsResponse>(key, fetchRuns, { revalidateOnFocus: false });

  return {
    // Sort ascending by ran_at so the chart plots left-to-right chronologically
    runs: useMemo(
      () => [...(data?.runs ?? [])].sort((a, b) => a.ran_at - b.ran_at),
      [data]
    ),
    total: data?.total ?? 0,
    isLoading: isLoading || isValidating,
    error,
  };
}

import { useMemo } from 'react';

import { useListBenchmarkRunRows } from '@/src/__codegen__/rest/benchmark';
import {
  RUN_ROW_OUTCOME_ALL,
  RUN_ROWS_PAGE_SIZE,
  type BenchmarkRunRow,
} from '@/src/app/benchmark/domain/benchmark_run_rows';

export interface BenchmarkRunRowsQuery {
  offset: number;
  category: string;
  outcome: string;
}

export function useBenchmarkRunRows(
  runId: string,
  { offset, category, outcome }: BenchmarkRunRowsQuery
) {
  // Memoize so the SWR key stays stable between renders. Empty filters are
  // omitted from the request rather than sent as empty strings.
  const params = useMemo(
    () => ({
      limit: RUN_ROWS_PAGE_SIZE,
      offset,
      ...(category ? { category } : {}),
      ...(outcome && outcome !== RUN_ROW_OUTCOME_ALL ? { outcome } : {}),
    }),
    [offset, category, outcome]
  );

  const { data, error, isLoading } = useListBenchmarkRunRows(runId, params, {
    swr: { revalidateOnFocus: false, keepPreviousData: true },
  });

  const rows = useMemo<BenchmarkRunRow[]>(
    () => (data?.status === 200 ? (data.data.rows ?? []) : []),
    [data]
  );

  // The generated fetcher resolves its promise for every HTTP status, so a
  // non-200 would otherwise read as "no rows". A 404 is its own state (the run
  // does not exist); every other failure surfaces as an error.
  const notFound = data?.status === 404;
  const httpError =
    data && data.status !== 200 && !notFound
      ? new Error(`benchmark run rows request failed (${data.status})`)
      : undefined;

  return {
    rows,
    total: data?.status === 200 ? (data.data.total ?? 0) : 0,
    isLoading,
    error: error ?? httpError,
    notFound,
  };
}

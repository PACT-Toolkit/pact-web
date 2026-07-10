import { useMemo } from 'react';

import { useGetBenchmarkCorpusLibrarySummary } from '@/src/__codegen__/rest/benchmark';
import { type BenchmarkCorpusDataset } from '@/src/app/benchmark/domain/benchmark_corpus_library';

export function useBenchmarkCorpusLibrary() {
  const { data, error, isLoading, isValidating } =
    useGetBenchmarkCorpusLibrarySummary({
      swr: { revalidateOnFocus: false },
    });

  // The gateway returns datasets pre-sorted (total_rows desc, source_dataset
  // asc) -- do not re-sort here, render in server order.
  const datasets = useMemo<BenchmarkCorpusDataset[]>(
    () => (data?.status === 200 ? (data.data.datasets ?? []) : []),
    [data]
  );

  // The generated fetcher resolves its promise for every HTTP status, so a
  // non-200 (401/5xx) would otherwise read as "empty library" rather than a
  // failure. Surface it as an error so the card can show its failure state.
  const httpError =
    data && data.status !== 200
      ? new Error(`benchmark corpus library request failed (${data.status})`)
      : undefined;

  return {
    datasets,
    totalRows: data?.status === 200 ? (data.data.total_rows ?? 0) : 0,
    isLoading: isLoading || isValidating,
    error: error ?? httpError,
  };
}

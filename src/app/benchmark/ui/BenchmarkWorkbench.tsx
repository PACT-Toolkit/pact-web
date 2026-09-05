'use client';

import { useState } from 'react';

import {
  submitBenchmarkJob,
  useGetBenchmarkJob,
} from '@/src/__codegen__/rest/benchmark';
import { type TrendDateRange } from '@/src/app/benchmark/domain/benchmark_run';
import { BenchmarkComparison } from '@/src/app/benchmark/ui/BenchmarkComparison';
import { BenchmarkConfusionTiles } from '@/src/app/benchmark/ui/BenchmarkConfusionTiles';
import { BenchmarkCorpusLibraryCard } from '@/src/app/benchmark/ui/BenchmarkCorpusLibraryCard';
import { BenchmarkJobProgress } from '@/src/app/benchmark/ui/BenchmarkJobProgress';
import { BenchmarkLatencyChart } from '@/src/app/benchmark/ui/BenchmarkLatencyChart';
import { BenchmarkResultsTable } from '@/src/app/benchmark/ui/BenchmarkResultsTable';
import { BenchmarkTrendChart } from '@/src/app/benchmark/ui/BenchmarkTrendChart';
import { BenchmarkTrendRangeToggle } from '@/src/app/benchmark/ui/BenchmarkTrendRangeToggle';
import { BenchmarkUploadForm } from '@/src/app/benchmark/ui/BenchmarkUploadForm';
import { getPublicGatewayBaseUrl } from '@/src/lib/proxy/gateway_url';

export const BenchmarkWorkbench = () => {
  const [dateRange, setDateRange] = useState<TrendDateRange>('90d');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data, isLoading } = useGetBenchmarkJob(jobId ?? '', undefined, {
    swr: {
      enabled: jobId !== null,
      refreshInterval: (latest) => {
        // No response yet: keep polling.
        if (!latest) return 2000;
        // Stop on a terminal HTTP error (404 unknown job, 401, 5xx) so we don't
        // poll a failing endpoint forever with the UI stuck on the spinner.
        if (latest.status !== 200) return 0;

        const status = latest.data.status;

        return status === 'done' || status === 'error' ? 0 : 2000;
      },
      revalidateOnFocus: false,
    },
  });

  const jobState = data?.status === 200 ? data.data : undefined;

  const handleSubmit = async (corpusText: string) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setJobId(null);

    try {
      const response = await submitBenchmarkJob({
        corpus_jsonl: corpusText,
        gateway_url: getPublicGatewayBaseUrl(),
      });
      if (response.status !== 202) {
        throw new Error('unexpected status');
      }
      setJobId(response.data.job_id);
    } catch {
      setSubmitError(
        'Failed to submit benchmark job. Is the gateway reachable?'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6" data-testid="benchmark-workbench">
      <BenchmarkTrendRangeToggle value={dateRange} onChange={setDateRange} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <BenchmarkTrendChart dateRange={dateRange} />
        <BenchmarkLatencyChart dateRange={dateRange} />
      </div>

      <BenchmarkComparison />

      <BenchmarkCorpusLibraryCard />

      <BenchmarkUploadForm
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />

      {submitError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {submitError}
        </p>
      )}

      {jobId && (
        <BenchmarkJobProgress
          jobId={jobId}
          state={jobState}
          isLoading={isLoading}
        />
      )}

      {jobId && jobState?.status === 'done' && jobState.result && (
        <>
          <BenchmarkConfusionTiles counts={jobState.result.counts} />
          <BenchmarkResultsTable
            key={jobId}
            jobId={jobId}
            totalRows={jobState.result.total_rows}
          />
        </>
      )}
    </div>
  );
};

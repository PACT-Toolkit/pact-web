'use client';

import { useState } from 'react';

import {
  submitBenchmarkJob,
  useGetBenchmarkJob,
} from '@/src/__codegen__/rest/benchmark';
import { BenchmarkComparison } from '@/src/app/benchmark/ui/BenchmarkComparison';
import { BenchmarkJobProgress } from '@/src/app/benchmark/ui/BenchmarkJobProgress';
import { BenchmarkResultsTable } from '@/src/app/benchmark/ui/BenchmarkResultsTable';
import { BenchmarkTrendChart } from '@/src/app/benchmark/ui/BenchmarkTrendChart';
import { BenchmarkUploadForm } from '@/src/app/benchmark/ui/BenchmarkUploadForm';

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_PACT_GATEWAY_URL ?? 'http://localhost:8080';

export const BenchmarkWorkbench = () => {
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
        gateway_url: GATEWAY_URL,
      });
      if (response.status !== 200 && response.status !== 202) {
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
    <div className="flex flex-col gap-6">
      <BenchmarkTrendChart />

      <BenchmarkComparison />

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
        <BenchmarkResultsTable
          key={jobId}
          jobId={jobId}
          totalRows={jobState.result.total_rows}
        />
      )}
    </div>
  );
};

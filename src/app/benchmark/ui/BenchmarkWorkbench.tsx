'use client';

import { useState } from 'react';
import useSWR from 'swr';

import { type BenchmarkJobState } from '@/src/app/benchmark/domain/benchmark_job';
import { BenchmarkJobProgress } from '@/src/app/benchmark/ui/BenchmarkJobProgress';
import { BenchmarkResultsTable } from '@/src/app/benchmark/ui/BenchmarkResultsTable';
import { BenchmarkTrendChart } from '@/src/app/benchmark/ui/BenchmarkTrendChart';
import { BenchmarkUploadForm } from '@/src/app/benchmark/ui/BenchmarkUploadForm';
import { httpClient } from '@/src/framework/http';

const GATEWAY_URL =
  process.env.NEXT_PUBLIC_PACT_GATEWAY_URL ?? 'http://localhost:8080';

const fetchJobState = (url: string) =>
  httpClient.get<BenchmarkJobState>(url).then((r) => r.data);

export const BenchmarkWorkbench = () => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { data: jobState, isLoading } = useSWR<BenchmarkJobState>(
    jobId ? `/api/pact/benchmark/v1/jobs/${jobId}` : null,
    fetchJobState,
    {
      refreshInterval: (data) => {
        if (!data) return 2000;

        return data.status === 'done' || data.status === 'error' ? 0 : 2000;
      },
      revalidateOnFocus: false,
    }
  );

  const handleSubmit = async (corpusText: string, gatewayVersion: string) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setJobId(null);

    try {
      const response = await httpClient.post<{ job_id: string }>(
        '/api/pact/benchmark/v1/jobs',
        {
          corpus_jsonl: corpusText,
          gateway_url: GATEWAY_URL,
          gateway_version: gatewayVersion || undefined,
        }
      );
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

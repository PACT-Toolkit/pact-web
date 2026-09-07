'use client';

import { useState } from 'react';

import {
  importBenchmarkDataset,
  submitBenchmarkJob,
} from '@/src/__codegen__/rest/benchmark';
import {
  describeHubImportError,
  type HubImportRequestDraft,
} from '@/src/app/benchmark/domain/benchmark_import';
import { type TrendDateRange } from '@/src/app/benchmark/domain/benchmark_run';
import { useBenchmarkJobState } from '@/src/app/benchmark/domain/use_benchmark_job_state';
import { BenchmarkComparison } from '@/src/app/benchmark/ui/BenchmarkComparison';
import { BenchmarkConfusionTiles } from '@/src/app/benchmark/ui/BenchmarkConfusionTiles';
import { BenchmarkCorpusLibraryCard } from '@/src/app/benchmark/ui/BenchmarkCorpusLibraryCard';
import { BenchmarkImportCard } from '@/src/app/benchmark/ui/BenchmarkImportCard';
import { BenchmarkImportSummary } from '@/src/app/benchmark/ui/BenchmarkImportSummary';
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

  const { isLoading, jobState, poll: jobPoll } = useBenchmarkJobState(jobId);

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

  const handleImportSubmit = async (request: HubImportRequestDraft) => {
    setIsSubmitting(true);
    setSubmitError(null);
    setJobId(null);

    try {
      const response = await importBenchmarkDataset({
        ...request,
        gateway_url: getPublicGatewayBaseUrl(),
      });
      if (response.status !== 202) {
        throw new Error(describeHubImportError(response.status, response.data));
      }
      setJobId(response.data.job_id);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'Failed to queue the import job. Is the gateway reachable?'
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

      <BenchmarkImportCard
        onSubmit={handleImportSubmit}
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
          poll={jobPoll}
        />
      )}

      {jobId && jobState?.status === 'done' && jobState.result && (
        <>
          {jobState.hub_import && (
            <BenchmarkImportSummary summary={jobState.hub_import} />
          )}
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

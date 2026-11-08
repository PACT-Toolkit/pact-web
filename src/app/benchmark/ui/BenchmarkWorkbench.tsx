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
import { describeBenchmarkSubmitError } from '@/src/app/benchmark/domain/benchmark_submit_error';
import { useBenchmarkJobState } from '@/src/app/benchmark/domain/use_benchmark_job_state';
import { BenchmarkComparison } from '@/src/app/benchmark/ui/BenchmarkComparison';
import { BenchmarkCorpusLibraryCard } from '@/src/app/benchmark/ui/BenchmarkCorpusLibraryCard';
import { BenchmarkImportCard } from '@/src/app/benchmark/ui/BenchmarkImportCard';
import { BenchmarkImportSummary } from '@/src/app/benchmark/ui/BenchmarkImportSummary';
import { BenchmarkJobProgress } from '@/src/app/benchmark/ui/BenchmarkJobProgress';
import { BenchmarkLatencyChart } from '@/src/app/benchmark/ui/BenchmarkLatencyChart';
import { BenchmarkResultsTable } from '@/src/app/benchmark/ui/BenchmarkResultsTable';
import { BenchmarkRunHistory } from '@/src/app/benchmark/ui/BenchmarkRunHistory';
import { BenchmarkSubmitErrorBanner } from '@/src/app/benchmark/ui/BenchmarkSubmitErrorBanner';
import { BenchmarkTrendChart } from '@/src/app/benchmark/ui/BenchmarkTrendChart';
import { BenchmarkTrendRangeToggle } from '@/src/app/benchmark/ui/BenchmarkTrendRangeToggle';
import { BenchmarkUploadForm } from '@/src/app/benchmark/ui/BenchmarkUploadForm';

export const BenchmarkWorkbench = () => {
  const [dateRange, setDateRange] = useState<TrendDateRange>('90d');
  const [jobId, setJobId] = useState<string | null>(null);
  const [isUploadSubmitting, setIsUploadSubmitting] = useState(false);
  const [isImportSubmitting, setIsImportSubmitting] = useState(false);
  // One state, so only one banner shows at a time; `source` places it under
  // the card that produced it.
  const [submitError, setSubmitError] = useState<{
    source: 'upload' | 'import';
    message: string;
  } | null>(null);

  const {
    isLoading,
    jobState,
    poll: jobPoll,
    rateLimitRetries,
  } = useBenchmarkJobState(jobId);

  const handleSubmit = async (corpusText: string) => {
    setIsUploadSubmitting(true);
    setSubmitError(null);
    setJobId(null);

    try {
      const response = await submitBenchmarkJob({
        corpus_jsonl: corpusText,
      });
      if (response.status !== 202) {
        setSubmitError({
          source: 'upload',
          message: describeBenchmarkSubmitError(response.status, response.data),
        });

        return;
      }
      setJobId(response.data.job_id);
    } catch {
      setSubmitError({
        source: 'upload',
        message: 'Failed to submit benchmark job. Is the gateway reachable?',
      });
    } finally {
      setIsUploadSubmitting(false);
    }
  };

  const handleImportSubmit = async (request: HubImportRequestDraft) => {
    setIsImportSubmitting(true);
    setSubmitError(null);
    setJobId(null);

    try {
      const response = await importBenchmarkDataset(request);
      if (response.status !== 202) {
        throw new Error(describeHubImportError(response.status, response.data));
      }
      setJobId(response.data.job_id);
    } catch (err) {
      setSubmitError({
        source: 'import',
        message:
          err instanceof Error
            ? err.message
            : 'Failed to queue the import job. Is the gateway reachable?',
      });
    } finally {
      setIsImportSubmitting(false);
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

      <BenchmarkRunHistory dateRange={dateRange} />

      <BenchmarkCorpusLibraryCard />

      <BenchmarkUploadForm
        onSubmit={handleSubmit}
        isSubmitting={isUploadSubmitting}
        disabled={isImportSubmitting}
      />

      {submitError?.source === 'upload' && (
        <BenchmarkSubmitErrorBanner message={submitError.message} />
      )}

      <BenchmarkImportCard
        onSubmit={handleImportSubmit}
        isSubmitting={isImportSubmitting}
        disabled={isUploadSubmitting}
      />

      {submitError?.source === 'import' && (
        <BenchmarkSubmitErrorBanner message={submitError.message} />
      )}

      {jobId && (
        <BenchmarkJobProgress
          jobId={jobId}
          state={jobState}
          isLoading={isLoading}
          poll={jobPoll}
          rateLimitRetries={rateLimitRetries}
        />
      )}

      {jobId && jobState?.status === 'done' && jobState.result && (
        <>
          {jobState.hub_import && (
            <BenchmarkImportSummary summary={jobState.hub_import} />
          )}
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

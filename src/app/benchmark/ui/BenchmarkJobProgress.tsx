'use client';

import { CheckCircle, Loader2, XCircle } from 'lucide-react';

import { type BenchmarkJobState } from '@/src/app/benchmark/domain/benchmark_job';
import { describeJobError } from '@/src/app/benchmark/domain/benchmark_job_error';
import { type BenchmarkJobPollDescription } from '@/src/app/benchmark/domain/benchmark_job_poll';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { formatPercent } from '@/src/framework/format/format_percent';

interface BenchmarkJobProgressProps {
  jobId: string;
  state: BenchmarkJobState | undefined;
  isLoading: boolean;
  poll: BenchmarkJobPollDescription;
}

const JobIdLabel = ({ jobId }: { jobId: string }) => (
  <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
    {jobId.slice(0, 12)}…
  </code>
);

export const BenchmarkJobProgress = ({
  jobId,
  state,
  isLoading,
  poll,
}: BenchmarkJobProgressProps) => {
  const status = state?.status ?? 'queued';
  const errorDescription =
    status === 'error' && state?.error ? describeJobError(state.error) : null;

  if (poll.kind === 'not_found') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <XCircle className="h-5 w-5 text-destructive" aria-hidden />
            Job <JobIdLabel jobId={jobId} />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p
            className="text-sm text-destructive"
            data-testid="benchmark-job-not-found"
          >
            This job could not be found. It may have expired, or the id is no
            longer valid.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {status === 'done' && (
            <CheckCircle className="h-5 w-5 text-green-500" aria-hidden />
          )}
          {status === 'error' && (
            <XCircle className="h-5 w-5 text-destructive" aria-hidden />
          )}
          {(status === 'queued' || status === 'running') && (
            <Loader2
              className="h-5 w-5 animate-spin text-muted-foreground"
              aria-hidden
            />
          )}
          Job <JobIdLabel jobId={jobId} />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div
            role="progressbar"
            aria-label="Benchmark progress"
            aria-valuenow={state?.progress_pct ?? 0}
            aria-valuemin={0}
            aria-valuemax={100}
            className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                status === 'done'
                  ? 'bg-green-500'
                  : status === 'error'
                    ? 'bg-destructive'
                    : 'bg-primary'
              }`}
              style={{
                width: `${status === 'queued' ? 5 : (state?.progress_pct ?? 5)}%`,
              }}
            />
          </div>
          <span
            aria-hidden="true"
            className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground"
          >
            {state?.progress_pct ?? 0}%
          </span>
        </div>

        {/* Status label */}
        <p
          aria-live="polite"
          aria-atomic="true"
          className="text-sm text-muted-foreground"
        >
          {isLoading && !state && 'Waiting for job status…'}
          {status === 'queued' && 'Job is queued, starting soon…'}
          {status === 'running' && 'Running corpus against the gateway…'}
          {status === 'done' && 'Benchmark complete.'}
          {status === 'error' && (
            <span className="flex flex-col gap-0.5">
              <span className="text-destructive">
                {errorDescription?.title ??
                  'An error occurred during the benchmark run.'}
              </span>
              {errorDescription?.detail && (
                <span className="text-xs text-muted-foreground">
                  {errorDescription.detail}
                </span>
              )}
              {errorDescription?.code && (
                <span
                  className="font-mono text-xs text-muted-foreground"
                  data-testid="benchmark-job-error-code"
                >
                  {errorDescription.code}
                </span>
              )}
            </span>
          )}
        </p>

        {/* Transient poll failure notice. Wording depends on whether we've
            ever seen a successful (HTTP 200) response for this job: once we
            have, `state` is retained across the failure (see
            use_benchmark_job_state.ts) and it's accurate to say the job is
            still in progress - retained state can be `queued` (a 429 right
            after submit) as well as `running`, so the wording must not claim
            "running" specifically; before we've seen any successful
            response, no run has actually been observed yet, so the notice
            must not claim one at all. */}
        {poll.kind === 'waiting' && (
          <p
            className="text-xs text-muted-foreground"
            data-testid="benchmark-job-poll-notice"
          >
            {state ? (
              <>
                Still in progress. The last status check returned HTTP{' '}
                {poll.httpStatus}; retrying.
              </>
            ) : (
              <>
                Waiting for the job status. The last check returned HTTP{' '}
                {poll.httpStatus}; retrying.
              </>
            )}
          </p>
        )}

        {/* Results summary */}
        {status === 'done' && state?.result && (
          <div className="grid grid-cols-2 gap-3 rounded-md border p-4 sm:grid-cols-4">
            <Stat
              label="Detection rate"
              value={formatPercent(state.result.detection_rate, {
                digits: 1,
              })}
            />
            <Stat
              label="False-positive rate"
              value={formatPercent(state.result.fp_rate, { digits: 1 })}
            />
            <Stat
              label="p50 latency"
              value={`${state.result.p50_latency_ms.toFixed(1)} ms`}
            />
            <Stat
              label="p99 latency"
              value={`${state.result.p99_latency_ms.toFixed(1)} ms`}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-lg font-semibold tabular-nums">{value}</span>
  </div>
);

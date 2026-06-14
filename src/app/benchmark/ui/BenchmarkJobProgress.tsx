'use client';

import { CheckCircle, Loader2, XCircle } from 'lucide-react';

import { type BenchmarkJobState } from '@/src/app/benchmark/domain/benchmark_job';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

interface BenchmarkJobProgressProps {
  jobId: string;
  state: BenchmarkJobState | undefined;
  isLoading: boolean;
}

export const BenchmarkJobProgress = ({
  jobId,
  state,
  isLoading,
}: BenchmarkJobProgressProps) => {
  const status = state?.status ?? 'queued';

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
          Job{' '}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-sm">
            {jobId.slice(0, 12)}…
          </code>
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
            <span className="text-destructive">
              {state?.error ?? 'An error occurred during the benchmark run.'}
            </span>
          )}
        </p>

        {/* Results summary */}
        {status === 'done' && state?.result && (
          <div className="grid grid-cols-2 gap-3 rounded-md border p-4 sm:grid-cols-4">
            <Stat
              label="Detection rate"
              value={`${(state.result.detection_rate * 100).toFixed(1)}%`}
            />
            <Stat
              label="False-positive rate"
              value={`${(state.result.fp_rate * 100).toFixed(1)}%`}
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

import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { type BenchmarkJobPollDescription } from '@/src/app/benchmark/domain/benchmark_job_poll';
import { BenchmarkJobProgress } from '@/src/app/benchmark/ui/BenchmarkJobProgress';

const POLLING: BenchmarkJobPollDescription = { kind: 'polling' };

describe('BenchmarkJobProgress', () => {
  it('shows a waiting notice with the HTTP status during a transient poll failure', () => {
    render(
      (
        <BenchmarkJobProgress
          jobId="job-123"
          state={{ status: 'running', progress_pct: 40 }}
          isLoading={false}
          poll={{ kind: 'waiting', httpStatus: 429 }}
        />
      ) as ReactNode
    );

    const notice = screen.getByTestId('benchmark-job-poll-notice');
    expect(notice).toHaveTextContent('Still in progress');
    expect(notice).toHaveTextContent('HTTP 429');
    // The progress card itself keeps rendering underneath the notice - the
    // job is still running, not replaced by a terminal error state.
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('shows a "waiting for the job status" notice when no state has been observed yet', () => {
    render(
      (
        <BenchmarkJobProgress
          jobId="job-123"
          state={undefined}
          isLoading={false}
          poll={{ kind: 'waiting', httpStatus: 429 }}
        />
      ) as ReactNode
    );

    // No successful response has ever arrived for this job, so the notice
    // must not claim it's "still in progress" - see the
    // regression this branch guards against.
    const notice = screen.getByTestId('benchmark-job-poll-notice');
    expect(notice).toHaveTextContent('Waiting for the job status');
    expect(notice).toHaveTextContent('HTTP 429');
    expect(notice).not.toHaveTextContent('Still in progress');
  });

  it('renders the done summary inside the card only once the job is done with a result', () => {
    const result = {
      detection_rate: 0.9,
      fp_rate: 0.1,
      p50_latency_ms: 10,
      p99_latency_ms: 50,
      rows: [],
      total_rows: 10,
    };
    const { rerender } = render(
      (
        <BenchmarkJobProgress
          jobId="job-123"
          state={{ status: 'running', progress_pct: 40, result }}
          isLoading={false}
          poll={POLLING}
        />
      ) as ReactNode
    );
    expect(
      screen.queryByTestId('benchmark-job-done-summary')
    ).not.toBeInTheDocument();

    rerender(
      (
        <BenchmarkJobProgress
          jobId="job-123"
          state={{ status: 'done', progress_pct: 100, result }}
          isLoading={false}
          poll={POLLING}
        />
      ) as ReactNode
    );
    expect(screen.getByTestId('benchmark-job-done-summary')).toHaveTextContent(
      'Detection rate90.0%'
    );
  });

  it('shows the rate-limit retry count on a 429 notice', () => {
    render(
      (
        <BenchmarkJobProgress
          jobId="job-123"
          state={{ status: 'running', progress_pct: 40 }}
          isLoading={false}
          poll={{ kind: 'waiting', httpStatus: 429 }}
          rateLimitRetries={3}
        />
      ) as ReactNode
    );

    expect(screen.getByTestId('benchmark-job-poll-notice')).toHaveTextContent(
      'Rate limited, retry 3.'
    );
  });

  it('omits the retry count for a non-429 failure', () => {
    render(
      (
        <BenchmarkJobProgress
          jobId="job-123"
          state={{ status: 'running', progress_pct: 40 }}
          isLoading={false}
          poll={{ kind: 'waiting', httpStatus: 503 }}
          rateLimitRetries={0}
        />
      ) as ReactNode
    );

    expect(
      screen.queryByTestId('benchmark-job-poll-retry-count')
    ).not.toBeInTheDocument();
  });

  it('renders no waiting notice while polling normally', () => {
    render(
      (
        <BenchmarkJobProgress
          jobId="job-123"
          state={{ status: 'running', progress_pct: 40 }}
          isLoading={false}
          poll={POLLING}
        />
      ) as ReactNode
    );

    expect(
      screen.queryByTestId('benchmark-job-poll-notice')
    ).not.toBeInTheDocument();
  });

  it('renders a terminal not-found state with the job id instead of the spinner', () => {
    render(
      (
        <BenchmarkJobProgress
          jobId="job-unknown-456"
          state={undefined}
          isLoading={false}
          poll={{ kind: 'not_found' }}
        />
      ) as ReactNode
    );

    expect(screen.getByTestId('benchmark-job-not-found')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    // BenchmarkJobProgress truncates the job id to its first 12 characters.
    expect(screen.getByText(/job-unknown-/)).toBeInTheDocument();
  });

  it('still shows the job error text once the job status itself is error', () => {
    render(
      (
        <BenchmarkJobProgress
          jobId="job-789"
          state={{
            status: 'error',
            progress_pct: 100,
            error: 'corpus row 12 failed to parse',
          }}
          isLoading={false}
          poll={{ kind: 'failed' }}
        />
      ) as ReactNode
    );

    expect(
      screen.getByText('corpus row 12 failed to parse')
    ).toBeInTheDocument();
  });

  it('shows operator-readable copy plus the raw code for a known job-failure code', () => {
    render(
      (
        <BenchmarkJobProgress
          jobId="job-auth"
          state={{
            status: 'error',
            progress_pct: 40,
            error: 'auth_token_expired',
          }}
          isLoading={false}
          poll={{ kind: 'failed' }}
        />
      ) as ReactNode
    );

    expect(
      screen.getByText('Your session expired before the run finished.')
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Sign in again and re-run the job. Rows already checked are not kept.'
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId('benchmark-job-error-code')).toHaveTextContent(
      'auth_token_expired'
    );
  });
});

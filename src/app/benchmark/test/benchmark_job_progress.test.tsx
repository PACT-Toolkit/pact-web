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
    // must not claim it's "still in progress" - see the PACT-956 follow-up
    // regression this branch guards against.
    const notice = screen.getByTestId('benchmark-job-poll-notice');
    expect(notice).toHaveTextContent('Waiting for the job status');
    expect(notice).toHaveTextContent('HTTP 429');
    expect(notice).not.toHaveTextContent('Still in progress');
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
});

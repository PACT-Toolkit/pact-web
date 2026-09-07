import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useSWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { getGetBenchmarkJobKey } from '@/src/__codegen__/rest/benchmark';
import { useBenchmarkJobState } from '@/src/app/benchmark/domain/use_benchmark_job_state';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// Exposes useSWRConfig().mutate alongside the hook under test so a test can
// force an immediate revalidation (the same code path SWR's refreshInterval
// timer drives) instead of waiting out the real 2s/5s poll delay.
const useHarness = (jobId: string | null) => ({
  ...useBenchmarkJobState(jobId),
  mutate: useSWRConfig().mutate,
});

const revalidate = async (
  mutate: ReturnType<typeof useSWRConfig>['mutate'],
  jobId: string
) => {
  await act(async () => {
    await mutate(getGetBenchmarkJobKey(jobId));
  });
};

describe('useBenchmarkJobState', () => {
  it('retains the last HTTP-200 job state across a transient 429 poll failure', async () => {
    const jobId = 'job-retain-1';
    let pollCount = 0;

    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/jobs/:jobId`, () => {
        pollCount += 1;

        // Poll 1: a real HTTP-200 running response at 40%. Poll 2+: a
        // transient 429, mirroring the coordinator's PACT-956 follow-up
        // scenario (429s landing mid-run, after progress already exists).
        return pollCount === 1
          ? HttpResponse.json({ status: 'running', progress_pct: 40 })
          : HttpResponse.json(
              { error: 'rate limit exceeded' },
              { status: 429 }
            );
      })
    );

    const { result } = renderHook(() => useHarness(jobId), {
      wrapper: SWRTestProvider,
    });

    await waitFor(() =>
      expect(result.current.jobState).toEqual({
        status: 'running',
        progress_pct: 40,
      })
    );
    expect(result.current.poll).toEqual({ kind: 'polling' });

    await revalidate(result.current.mutate, jobId);

    await waitFor(() =>
      expect(result.current.poll).toEqual({ kind: 'waiting', httpStatus: 429 })
    );
    // Regression guard (PACT-956 follow-up): the card's data source must not
    // snap back to undefined during the 429 window - it must keep showing
    // the last known-good running/40% state.
    expect(result.current.jobState).toEqual({
      status: 'running',
      progress_pct: 40,
    });
  });

  it('clears the retained state when jobId changes to a new job', async () => {
    const oldJobId = 'job-old';
    const newJobId = 'job-new';

    server.use(
      http.get(
        `${MSW_PACT_BASE}/gateway/v1/benchmark/jobs/:jobId`,
        ({ params }) =>
          params.jobId === oldJobId
            ? HttpResponse.json({ status: 'running', progress_pct: 77 })
            : HttpResponse.json(
                { error: 'rate limit exceeded' },
                { status: 429 }
              )
      )
    );

    const { result, rerender } = renderHook(({ jobId }) => useHarness(jobId), {
      wrapper: SWRTestProvider,
      initialProps: { jobId: oldJobId },
    });

    await waitFor(() =>
      expect(result.current.jobState).toEqual({
        status: 'running',
        progress_pct: 77,
      })
    );

    // A brand new job starts (the workbench does this on every submit) and
    // its first poll is a 429 before any progress exists for it - the old
    // job's 77% must not leak into the new job's card.
    rerender({ jobId: newJobId });

    await waitFor(() =>
      expect(result.current.poll).toEqual({ kind: 'waiting', httpStatus: 429 })
    );
    expect(result.current.jobState).toBeUndefined();
  });
});

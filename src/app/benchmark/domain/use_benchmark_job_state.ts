import { useState } from 'react';

import {
  useGetBenchmarkJob,
  type getBenchmarkJobResponse,
} from '@/src/__codegen__/rest/benchmark';
import { type BenchmarkJobState } from '@/src/app/benchmark/domain/benchmark_job';
import {
  describeBenchmarkJobPoll,
  nextBenchmarkJobPollDelayMs,
  type BenchmarkJobPollDescription,
} from '@/src/app/benchmark/domain/benchmark_job_poll';

interface Retained {
  jobId: string | null;
  data: getBenchmarkJobResponse | undefined;
  state: BenchmarkJobState | undefined;
}

/**
 * Polls GET /v1/benchmark/jobs/:id for BenchmarkWorkbench and retains the
 * last HTTP-200 job state across transient poll failures (429/401/5xx/no
 * response), so the progress card keeps showing the real status and
 * percentage instead of snapping back to "queued 0%" during a `waiting`
 * window - SWR's `data` is only the *latest* resolved response, and that
 * latest response is the error body while a transient failure is in
 * flight.
 *
 * Uses React's "storing information from previous renders" pattern
 * (react.dev/reference/react/useState#storing-information-from-previous-renders)
 * rather than a `useEffect` that syncs state (pact-react-patterns rule 4):
 * `setRetained` is called directly in the render body, guarded by a
 * condition (`jobId` or `data` changed) that the call itself makes false,
 * so React re-renders once with the new value and never loops.
 */
export function useBenchmarkJobState(jobId: string | null) {
  const { data, isLoading } = useGetBenchmarkJob(jobId ?? '', undefined, {
    swr: {
      enabled: jobId !== null,
      refreshInterval: nextBenchmarkJobPollDelayMs,
      revalidateOnFocus: false,
    },
  });

  const [retained, setRetained] = useState<Retained>({
    jobId,
    data: undefined,
    state: undefined,
  });

  if (retained.jobId !== jobId) {
    // A new job started (or the job was cleared) - drop the previous job's
    // retained state so its numbers never leak into the new job's card.
    setRetained({
      jobId,
      data,
      state: data?.status === 200 ? data.data : undefined,
    });
  } else if (retained.data !== data) {
    setRetained({
      jobId,
      data,
      // Only a successful response updates the retained state; a transient
      // failure keeps whatever was last known-good.
      state: data?.status === 200 ? data.data : retained.state,
    });
  }

  const jobState = retained.jobId === jobId ? retained.state : undefined;
  const poll: BenchmarkJobPollDescription = describeBenchmarkJobPoll(data);

  return { data, isLoading, jobState, poll };
}

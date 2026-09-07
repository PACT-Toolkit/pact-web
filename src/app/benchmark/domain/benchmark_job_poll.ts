import { type getBenchmarkJobResponse } from '@/src/__codegen__/rest/benchmark';

// GET /v1/benchmark/jobs/:id polling classification for BenchmarkWorkbench.
// customFetch (src/__codegen__/rest/custom_fetch.ts) never throws on HTTP
// status - every response, including a non-2xx one, resolves normally as
// `{ data, status, headers }` - so `latest` here is the resolved fetcher
// value SWR's refreshInterval callback receives, not a thrown error. The
// generated `getBenchmarkJobResponse` union only declares status literals
// 200/400/401/404/502, but the real gateway can answer with any HTTP status
// (429 from its per-IP rate limiter, other 5xx codes, 504 from an upstream
// timeout) - the fallback branch below treats every status this union
// doesn't name as a transient failure worth retrying, the same way
// audit_decision_stats_access.ts's isDecisionStatsFailure widens past its
// declared literals.
export type BenchmarkJobPollDescription =
  | { kind: 'polling' }
  | { kind: 'waiting'; httpStatus: number }
  | { kind: 'not_found' }
  | { kind: 'done' }
  | { kind: 'failed' };

/**
 * Classifies the latest resolved GET /v1/benchmark/jobs/:id response for
 * BenchmarkWorkbench: no response yet or a running/queued job is `polling`,
 * a completed job is `done` or `failed`, an unknown job id is a terminal
 * `not_found`, and every other non-200 status (429 from the gateway's
 * per-IP rate limiter, 401, 5xx, a network failure that leaves `latest`
 * unset) is a transient `waiting` the UI should surface but keep retrying
 * through.
 */
export const describeBenchmarkJobPoll = (
  latest: getBenchmarkJobResponse | undefined
): BenchmarkJobPollDescription => {
  if (!latest) return { kind: 'polling' };

  if (latest.status === 200) {
    const jobStatus = latest.data.status;
    if (jobStatus === 'done') return { kind: 'done' };
    if (jobStatus === 'error') return { kind: 'failed' };

    return { kind: 'polling' };
  }

  if (latest.status === 404) return { kind: 'not_found' };

  return { kind: 'waiting', httpStatus: latest.status };
};

/**
 * SWR `refreshInterval` policy for GET /v1/benchmark/jobs/:id, derived from
 * `describeBenchmarkJobPoll` so the two never drift: a job still in flight
 * polls every 2s, a completed or unknown job stops (0), and a transient
 * failure keeps polling - 5s for HTTP 429 to respect the gateway's
 * per-IP /v1/benchmark limiter (5 rps / burst 10), 2s for everything else
 * (401, other 5xx, no response yet).
 */
export const nextBenchmarkJobPollDelayMs = (
  latest: getBenchmarkJobResponse | undefined
): number => {
  const description = describeBenchmarkJobPoll(latest);

  switch (description.kind) {
    case 'polling':
      return 2000;
    case 'waiting':
      return description.httpStatus === 429 ? 5000 : 2000;
    case 'not_found':
    case 'done':
    case 'failed':
      return 0;
  }
};

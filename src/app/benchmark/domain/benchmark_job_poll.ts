import { type getBenchmarkJobResponse } from '@/src/__codegen__/rest/benchmark';
import { RATE_LIMITED_STATUS, rateLimitDelayMs } from '@/src/framework/http';

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
// isNonForbiddenFailure (src/framework/http) widens past declared status
// literals.
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

const JOB_POLL_INTERVAL_MS = 2000;
// Back-off base for HTTP 429 from the gateway's per-IP /v1/benchmark limiter
// (5 rps / burst 10) when the response carries no usable Retry-After.
const JOB_POLL_RATE_LIMIT_BASE_MS = 5000;

/**
 * SWR `refreshInterval` policy for GET /v1/benchmark/jobs/:id, derived from
 * `describeBenchmarkJobPoll` so the two never drift: a job still in flight
 * polls every 2s, a completed or unknown job stops (0), and a transient
 * failure keeps polling - after the shared 429 back-off delay for HTTP 429
 * (the response's Retry-After when present, else 5s, never faster than the
 * normal 2s cadence), 2s for everything else (401, other 5xx, no response
 * yet). The refreshInterval callback only sees the latest response, so the
 * fallback does not escalate across consecutive 429s.
 */
export const nextBenchmarkJobPollDelayMs = (
  latest: getBenchmarkJobResponse | undefined
): number => {
  const description = describeBenchmarkJobPoll(latest);

  switch (description.kind) {
    case 'polling':
      return JOB_POLL_INTERVAL_MS;
    case 'waiting':
      if (description.httpStatus !== RATE_LIMITED_STATUS) {
        return JOB_POLL_INTERVAL_MS;
      }

      return Math.max(
        JOB_POLL_INTERVAL_MS,
        rateLimitDelayMs({
          attempt: 0,
          retryAfter: latest?.headers?.get('retry-after'),
          baseDelayMs: JOB_POLL_RATE_LIMIT_BASE_MS,
        })
      );
    case 'not_found':
    case 'done':
    case 'failed':
      return 0;
  }
};

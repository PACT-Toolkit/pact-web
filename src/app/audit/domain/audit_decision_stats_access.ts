import { type SWRConfiguration } from 'swr';

import { type QueryDecisionStatsQueryResult } from '@/src/__codegen__/rest/audit';

// Classifies GET /v1/audit/stats outcomes as a permission error (HTTP 403)
// versus every other outcome. Shared by the two consumers of the decision
// stats aggregate -- useDashboardPipelineStats (dashboard) and
// useFilterDecisionStats (filter workbench) -- so both react identically to
// PACT-363's audit:stats permission gate: stop polling a permanently
// forbidden endpoint and render a permission-aware empty state instead of a
// raw error banner.
//
// The generated fetcher (see __codegen__/rest/audit/fetchers.ts) never
// throws on a non-2xx response -- every status, including 403, resolves
// normally as `{ data, status, headers }` -- so the primary signal is the
// resolved `status`, not SWR's `error`. The `response?.status` branch is
// defensive: it covers a thrown Axios-shaped error, in case a caller passes
// this to onErrorRetry (which receives whatever the fetcher throws) or the
// fetcher's throw-on-error behaviour ever changes.
export const isDecisionStatsForbidden = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  const status = (value as { status?: unknown }).status;
  if (status === 403) return true;

  const response = (value as { response?: { status?: unknown } }).response;

  return response?.status === 403;
};

/**
 * SWR polling config for GET /v1/audit/stats, shared by both consumers so
 * neither keeps hammering a permanently forbidden endpoint:
 *
 * - `refreshInterval` is conditional on the latest resolved response -- once
 *   a 403 is seen, it returns 0 (disabled) instead of `intervalMs`. This is
 *   the mechanism that actually stops polling here, since the fetcher never
 *   throws on a 403 (see isDecisionStatsForbidden above).
 * - `onErrorRetry` bails out on a 403 too, replicating SWR's default
 *   config-driven backoff (see swr's internal onErrorRetry) for every other
 *   thrown error. This is defensive: it only matters if the fetcher's
 *   throw-on-error behaviour changes later, or a network-level wrapper
 *   rethrows a 403 as an exception.
 */
export const decisionStatsPollingConfig = (
  intervalMs: number
): Pick<
  SWRConfiguration<QueryDecisionStatsQueryResult>,
  'refreshInterval' | 'onErrorRetry'
> => ({
  refreshInterval: (latestData) =>
    isDecisionStatsForbidden(latestData) ? 0 : intervalMs,
  onErrorRetry: (error, _key, config, revalidate, revalidateOpts) => {
    if (isDecisionStatsForbidden(error)) return;

    const { retryCount } = revalidateOpts;
    if (
      config.errorRetryCount !== undefined &&
      retryCount > config.errorRetryCount
    ) {
      return;
    }
    setTimeout(() => revalidate(revalidateOpts), config.errorRetryInterval);
  },
});

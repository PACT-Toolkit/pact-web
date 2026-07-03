import { useMemo } from 'react';

import { useQueryPolicyEvents } from '@/src/__codegen__/rest/audit';

// Same fetch-window/refresh cadence as ClassifierWorkbench and the other
// pact.decisions consoles: server-side clamp is 200 (audit.Service.MaxLimit)
// and 30s matches the app-wide live-feed refresh.
const FETCH_WINDOW_SIZE = 200;
const REFRESH_INTERVAL_MS = 30_000;

// usePolicyEvents wraps the generated useQueryPolicyEvents SWR hook (GET
// /v1/audit/policy-events) with the params/polling config PolicyEventsFeed
// needs. Replaces a hand-rolled fetch this feature used before schema/audit
// gained the policy-events path (PACT-326): the two shared the same
// domain-vocabulary shape by design (pact-gateway's
// internal/features/audit/types.go says as much), so swapping the
// transport is a pure refactor, not a contract change.
export function usePolicyEvents() {
  const params = useMemo(() => ({ limit: FETCH_WINDOW_SIZE }), []);

  const { data, error, isLoading, isValidating, mutate } = useQueryPolicyEvents(
    params,
    {
      swr: {
        refreshInterval: REFRESH_INTERVAL_MS,
        revalidateOnFocus: false,
        keepPreviousData: true,
      },
    }
  );

  const events = useMemo(
    () => (data?.status === 200 ? data.data.events : []),
    [data]
  );

  // The generated fetcher resolves its promise for every HTTP status, so a
  // non-200 (401/400) would otherwise read as "no events" rather than a
  // failure. Surface it so the feed can show its error state, same pattern
  // as use_policy_rules.ts's httpError.
  const httpError =
    data && data.status !== 200
      ? new Error(`policy events request failed (${data.status})`)
      : undefined;

  return {
    events,
    error: error ?? httpError,
    isLoading,
    isValidating,
    mutate,
  };
}

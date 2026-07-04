import { useGetConfig } from '@/src/__codegen__/rest/config';

// Same cadence as PolicyEventsFeed's live decisions poll, but shorter: config
// is the smallest, cheapest payload on this page and every other section
// (sandbox/diagnostics/spotlight) reads its enabled/disabled state off this
// same hook, so a fresher poll keeps the whole page's gating in sync with an
// operator flipping an env var and restarting the gateway.
const REFRESH_INTERVAL_MS = 15_000;

// useGatewayConfig wraps the generated useGetConfig SWR hook (GET /v1/config)
// with this page's polling cadence. Every /gateway section calls this same
// hook rather than receiving config as a prop -- SWR dedupes identical keys,
// so this is one network request shared across the page, not four.
export function useGatewayConfig() {
  const { data, error, isLoading, isValidating, mutate } = useGetConfig({
    swr: {
      refreshInterval: REFRESH_INTERVAL_MS,
      revalidateOnFocus: false,
    },
  });

  const config = data?.status === 200 ? data.data : undefined;

  // Same non-200-reads-as-empty trap called out in use_policy_events.ts: the
  // generated fetcher resolves for every HTTP status, so a 401/429 would
  // otherwise render as "config missing" instead of a failure.
  const httpError =
    data && data.status !== 200
      ? new Error(`gateway config request failed (${data.status})`)
      : undefined;

  return {
    config,
    error: error ?? httpError,
    isLoading,
    isValidating,
    mutate,
  };
}

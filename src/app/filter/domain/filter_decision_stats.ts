import { useMemo } from 'react';

import { useGetAuditStats } from '@/src/__codegen__/rest/audit';
import {
  type DecisionStatsFilter,
  decisionStatsPollingConfig,
  isDecisionStatsFailure,
  isDecisionStatsForbidden,
  normalizeDecisionStats,
} from '@/src/app/audit/domain/audit_decision_stats_access';

// How often the server-side aggregate re-polls. Matches the app's standard
// background refresh cadence (see dashboard_pipeline_stats.ts, AuditWorkbench,
// ConsensusWorkbench, use_policy_events).
export const STATS_REFRESH_MS = 30_000;

// The workbench's headline stat cards and top-rules breakdown, straight from
// GET /v1/audit/stats. Fully required -- see normalizeDecisionStats in
// audit_decision_stats_access.ts, shared with useDashboardPipelineStats so
// both consumers of the aggregate default the same fields the same way. The
// workbench has no time-range controls, so the query is unbounded -- same
// convention as useDashboardPipelineStats.
export type FilterDecisionStats = DecisionStatsFilter;

/**
 * SWR-backed source for the workbench's aggregate stat cards and top-rules
 * breakdown. Independent of the live decision stream query -- the stream
 * still reads its own `pact.decisions` event window for the row list; only
 * these headline numbers come from the server-side aggregate.
 */
export const useFilterDecisionStats = () => {
  const { data, error, isLoading, isValidating, mutate } = useGetAuditStats(
    undefined,
    {
      swr: {
        ...decisionStatsPollingConfig(STATS_REFRESH_MS),
        revalidateOnFocus: false,
        keepPreviousData: true,
      },
    }
  );

  // total is a plain property read on the existing SWR response -- as cheap
  // as the access itself, no useMemo needed. normalizeDecisionStats builds a
  // fresh nested object every call, so it's memoized on `data` to match
  // useDashboardPipelineStats's pattern (dashboard_pipeline_stats.ts), the
  // other consumer of the same normalization helper.
  const total = data?.status === 200 ? (data.data.total ?? 0) : 0;
  const filter = useMemo(
    () =>
      normalizeDecisionStats(data?.status === 200 ? data.data : undefined)
        .filter,
    [data]
  );

  // A 403 (PACT-363's audit:stats permission gate) is a stable, expected
  // outcome for non-operator users -- not a transient error. The workbench
  // renders a permission-aware empty state for this instead of the "try
  // refreshing" copy that fits a real transient failure.
  const forbidden = isDecisionStatsForbidden(data);

  // PACT-914: the fetcher never throws on a non-2xx (see
  // audit_decision_stats_access.ts's docblock), so a resolved-but-failed
  // response (e.g. a stale bearer racing a session rotation coming back 401)
  // previously slipped past both `error` (SWR's thrown error, which never
  // fires here) and `forbidden` (403-only) and rendered as a convincing
  // all-zero stat block. isDecisionStatsFailure catches every other non-200,
  // non-403 status so the workbench's existing "try refreshing" error state
  // renders instead of silent zeros.
  const failed = isDecisionStatsFailure(data);

  return {
    total,
    filter,
    error: Boolean(error) || failed,
    forbidden,
    isLoading,
    isValidating,
    mutate,
  };
};

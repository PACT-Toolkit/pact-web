import { useGetAuditStats } from '@/src/__codegen__/rest/audit';
import {
  type DecisionStatsFilter,
  decisionStatsPollingConfig,
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

  // Plain property reads on the existing SWR response, not derived
  // computation -- no useMemo needed, they're as cheap as the access itself.
  const total = data?.status === 200 ? (data.data.total ?? 0) : 0;
  const filter = normalizeDecisionStats(
    data?.status === 200 ? data.data : undefined
  ).filter;

  // A 403 (PACT-363's audit:stats permission gate) is a stable, expected
  // outcome for non-operator users -- not a transient error. The workbench
  // renders a permission-aware empty state for this instead of the "try
  // refreshing" copy that fits a real transient failure.
  const forbidden = isDecisionStatsForbidden(data);

  return {
    total,
    filter,
    error: Boolean(error),
    forbidden,
    isLoading,
    isValidating,
    mutate,
  };
};

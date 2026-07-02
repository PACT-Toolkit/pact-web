import {
  type QueryDecisionStatsResponse,
  useQueryDecisionStats,
} from '@/src/__codegen__/rest/audit';

// How often the server-side aggregate re-polls. Matches the app's standard
// background refresh cadence (see dashboard_pipeline_stats.ts, AuditWorkbench,
// ConsensusWorkbench, use_policy_events).
export const STATS_REFRESH_MS = 30_000;

// The workbench's headline stat cards and top-rules breakdown, straight from
// GET /v1/audit/stats. Derived from the generated response types rather than
// redeclared, so the UI can never drift from the wire contract (see
// pact-domain-layer). The workbench has no time-range controls, so the query
// is unbounded -- same convention as useDashboardPipelineStats.
export type FilterDecisionStats = QueryDecisionStatsResponse['filter'];

const EMPTY_FILTER_STATS: FilterDecisionStats = {
  flagged: 0,
  blocked: 0,
  block_rate: 0,
  top_rule_id: '',
  suspicious: 0,
  hostile: 0,
  top_rules: [],
};

/**
 * SWR-backed source for the workbench's aggregate stat cards and top-rules
 * breakdown. Independent of the live decision stream query -- the stream
 * still reads its own `pact.decisions` event window for the row list; only
 * these headline numbers come from the server-side aggregate.
 */
export const useFilterDecisionStats = () => {
  const { data, error, isLoading, isValidating, mutate } =
    useQueryDecisionStats(undefined, {
      swr: {
        refreshInterval: STATS_REFRESH_MS,
        revalidateOnFocus: false,
        keepPreviousData: true,
      },
    });

  // Plain property reads on the existing SWR response, not derived
  // computation -- no useMemo needed, they're as cheap as the access itself.
  const total = data?.status === 200 ? data.data.total : 0;
  const filter = data?.status === 200 ? data.data.filter : EMPTY_FILTER_STATS;

  return {
    total,
    filter,
    error: Boolean(error),
    isLoading,
    isValidating,
    mutate,
  };
};

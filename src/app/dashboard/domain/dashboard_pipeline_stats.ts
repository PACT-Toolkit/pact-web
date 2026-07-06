import { useMemo } from 'react';

import {
  type AuditEvent,
  type DecisionStatsLabelCount,
  type QueryDecisionStatsResponse,
  useQueryAuditEvents,
  useQueryDecisionStats,
} from '@/src/__codegen__/rest/audit';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/app/audit/domain/audit_decision_payload';
import {
  decisionStatsPollingConfig,
  isDecisionStatsForbidden,
} from '@/src/app/audit/domain/audit_decision_stats_access';

// Number of most-recent pact.decisions events the live stream window holds.
// Only feeds DashboardLiveDecisions now -- the headline stat widgets get
// their numbers from the server-side aggregate below, not this window.
const DECISIONS_WINDOW = 200;

// How often the live stream re-polls when the live toggle is on.
export const LIVE_REFRESH_MS = 10_000;

// How often the server-side aggregate re-polls. Matches the app's standard
// background refresh cadence (see FilterDecisionsWorkbench, AuditWorkbench,
// ConsensusWorkbench, use_policy_events) -- independent of the live toggle,
// since the aggregate is cheap to recompute server-side either way.
export const STATS_REFRESH_MS = 30_000;

// Labels that mean "no injection detected". Compared case-insensitively so the
// stub engine ("benign") and DeBERTa ("BENIGN") both fold into the benign set.
//
// classifier.label is an open set by design in the pact.decisions schema
// (src/__codegen__/schema/pact-decisions -- ClassifierDecision.label has no
// enum; pact-classifier owns the label vocabulary and can add heads without
// a gateway schema change), so this list cannot be sourced from a schema
// enum the way decision/filter.verdict/redactor.verdict are. It is instead
// the single exported source of truth pact-web maintains for "which labels
// count as benign" -- pact-audit's SQL-side stats aggregate mirrors this
// same list (PACT-426); if either side adds a label here, update the other.
export const BENIGN_CLASSIFIER_LABELS = new Set([
  'benign',
  'none',
  'safe',
  'clean',
  '',
]);

// The dashboard's headline stats, straight from GET /v1/audit/stats. Derived
// from the generated response types rather than redeclared, so the UI can
// never drift from the wire contract (see pact-domain-layer). All rates are
// 0-100 and label arrays are always present (possibly empty), never null --
// pact-gateway's DTOs have no omitempty and every field here is required in
// schema/audit/swagger.yaml, so no NonNullable<...> unwrapping is needed.
export type PipelineStats = QueryDecisionStatsResponse;
export type FilterStats = PipelineStats['filter'];
export type ClassifierStats = PipelineStats['classifier'];
export type RedactorStats = PipelineStats['redactor'];
export type LabelCount = DecisionStatsLabelCount;

const EMPTY_STATS: PipelineStats = {
  total: 0,
  latest_at_unix: 0,
  filter: {
    flagged: 0,
    blocked: 0,
    block_rate: 0,
    top_rule_id: '',
    suspicious: 0,
    hostile: 0,
    top_rules: [],
  },
  classifier: {
    responded: 0,
    tagged: 0,
    top_label: '',
    avg_tagged_score: 0,
    consensus: 0,
    labels: [],
  },
  redactor: {
    redacted: 0,
    spans: 0,
    redaction_rate: 0,
    span_labels: [],
  },
};

// A parsed pact.decisions row: the raw audit event plus its decoded payload.
// Feeds the live stream (DashboardLiveDecisions), which still reads its own
// event window -- only the headline stat widgets moved server-side.
export interface DecisionRecord {
  event: AuditEvent;
  dp: DecisionPayload;
}

export type DecisionSeverity = 'blocked' | 'flagged' | 'clean';

const isFilterFlagged = (dp: DecisionPayload): boolean => {
  const v = dp.filter?.verdict?.toLowerCase();

  return v === 'suspicious' || v === 'hostile';
};

const isBenignLabel = (label: string): boolean =>
  BENIGN_CLASSIFIER_LABELS.has(label.toLowerCase());

const isClassifierTagged = (dp: DecisionPayload): boolean =>
  Boolean(dp.classifier?.label) && !isBenignLabel(dp.classifier?.label ?? '');

const isRedacted = (dp: DecisionPayload): boolean =>
  dp.redactor?.verdict === 'redacted' || (dp.redactor?.spans?.length ?? 0) > 0;

/**
 * Severity bucket for the stream filter:
 * - `blocked` — the gateway returned a block decision.
 * - `flagged` — allowed, but at least one stage raised a signal.
 * - `clean`   — allowed with no signal.
 */
export const decisionSeverity = (dp: DecisionPayload): DecisionSeverity => {
  if (dp.decision === 'block') return 'blocked';
  if (isFilterFlagged(dp) || isClassifierTagged(dp) || isRedacted(dp)) {
    return 'flagged';
  }

  return 'clean';
};

export const parseDecisions = (events: AuditEvent[]): DecisionRecord[] => {
  const records: DecisionRecord[] = [];
  for (const event of events) {
    const dp = parseDecisionPayload(event.payloadJson);
    if (dp) records.push({ event, dp });
  }

  return records;
};

/**
 * Console data source: the live decision stream and the headline stat
 * widgets, backed by two independent SWR queries.
 *
 * - `records` - the last DECISIONS_WINDOW pact.decisions events, re-polled
 *   at LIVE_REFRESH_MS while `live` is true. Feeds DashboardLiveDecisions.
 * - `stats` - the exact server-side aggregate over all of the caller's
 *   history (unbounded; the console has no time-range controls), re-polled
 *   at STATS_REFRESH_MS regardless of the live toggle. Feeds the Filter /
 *   Classifier / Redactor widgets.
 *
 * `mutate` revalidates both so a completed probe (DashboardQuickProbe)
 * refreshes the stream and the numbers together.
 */
export const useDashboardPipelineStats = (live: boolean) => {
  const eventsParams = useMemo(
    () => ({ topic: 'pact.decisions', limit: DECISIONS_WINDOW }),
    []
  );

  const eventsQuery = useQueryAuditEvents(eventsParams, {
    swr: {
      refreshInterval: live ? LIVE_REFRESH_MS : 0,
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  });

  const statsQuery = useQueryDecisionStats(undefined, {
    swr: {
      ...decisionStatsPollingConfig(STATS_REFRESH_MS),
      revalidateOnFocus: false,
      keepPreviousData: true,
    },
  });

  const records = useMemo(
    () =>
      eventsQuery.data?.status === 200
        ? parseDecisions(eventsQuery.data.data.events)
        : [],
    [eventsQuery.data]
  );

  const stats = useMemo(
    () =>
      statsQuery.data?.status === 200 ? statsQuery.data.data : EMPTY_STATS,
    [statsQuery.data]
  );

  // A 403 on /v1/audit/stats (PACT-363's audit:stats permission gate) is a
  // stable, expected outcome for non-operator users -- not a transient
  // error. The Filter/Classifier/Redactor widgets render a permission-aware
  // empty state for this instead of the generic error banner.
  const statsForbidden = isDecisionStatsForbidden(statsQuery.data);

  const mutate = () => {
    void eventsQuery.mutate();
    void statsQuery.mutate();
  };

  return {
    stats,
    records,
    error: Boolean(eventsQuery.error) || Boolean(statsQuery.error),
    statsForbidden,
    isLoading: eventsQuery.isLoading || statsQuery.isLoading,
    isValidating: eventsQuery.isValidating || statsQuery.isValidating,
    mutate,
  };
};

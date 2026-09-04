import { type SWRConfiguration } from 'swr';

import {
  type AuditDecisionStatsLabelCount,
  type AuditQueryDecisionStatsResponse,
  type GetAuditStatsQueryResult,
} from '@/src/__codegen__/rest/audit';

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

// Classifies a resolved GET /v1/audit/stats response as a failure that is
// neither the success path (200) nor the already-handled permission gate
// (403) -- e.g. a stale bearer racing a session rotation coming back 401
// (PACT-914), or a 5xx. Before this, only the 403 case was special-cased:
// any other non-200 status silently normalized to EMPTY_DECISION_STATS with
// no `error` flag set, so the stat cards rendered a convincing "0 / 0 / 0 /
// 0.0%" with no indication anything had gone wrong. `value` is the same
// resolved fetcher shape isDecisionStatsForbidden reads (`{ data, status,
// headers }`), not SWR's thrown `error` -- callers OR this with
// `Boolean(error)` to also catch a genuinely thrown/rejected fetch.
export const isDecisionStatsFailure = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  const status = (value as { status?: unknown }).status;

  return typeof status === 'number' && status !== 200 && status !== 403;
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
  SWRConfiguration<GetAuditStatsQueryResult>,
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

// GET /v1/audit/stats is now served from pact-gateway's generated per-tag
// OpenAPI slice (PACT-706), which has no `required:` markers -- every field
// on AuditQueryDecisionStatsResponse and its sub-objects is optional, even
// though pact-gateway's DTOs never actually omit them. Both consumers
// (useDashboardPipelineStats, useFilterDecisionStats) want a fully-populated
// shape so their widgets don't need optional-chaining sprinkled through
// render code, so the "every rate is a number, every array is present"
// normalization lives here once, rather than as two separately hand-kept
// EMPTY_STATS-shaped literals that would have to change together.
export type DecisionStatsLabelCount = Required<AuditDecisionStatsLabelCount>;

export interface DecisionStatsFilter {
  flagged: number;
  blocked: number;
  block_rate: number;
  top_rule_id: string;
  suspicious: number;
  hostile: number;
  top_rules: DecisionStatsLabelCount[];
}

export interface DecisionStatsClassifier {
  responded: number;
  tagged: number;
  top_label: string;
  avg_tagged_score: number;
  consensus: number;
  labels: DecisionStatsLabelCount[];
}

export interface DecisionStatsRedactor {
  redacted: number;
  spans: number;
  redaction_rate: number;
  span_labels: DecisionStatsLabelCount[];
}

export interface DecisionStatsSummary {
  total: number;
  latest_at_unix: number;
  filter: DecisionStatsFilter;
  classifier: DecisionStatsClassifier;
  redactor: DecisionStatsRedactor;
}

const normalizeLabelCounts = (
  counts: AuditDecisionStatsLabelCount[] | undefined
): DecisionStatsLabelCount[] =>
  (counts ?? []).map((count) => ({
    label: count.label ?? '',
    count: count.count ?? 0,
  }));

export const EMPTY_DECISION_STATS: DecisionStatsSummary = {
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

/**
 * Fills in every optional field of a GET /v1/audit/stats response with the
 * same zero-value defaults pact-gateway's DTOs already guarantee at runtime,
 * so callers get a fully-required DecisionStatsSummary regardless of what
 * the generated (all-optional) response type claims. Pass `undefined` for
 * the no-data-yet / non-200 case to get EMPTY_DECISION_STATS back.
 */
export const normalizeDecisionStats = (
  response: AuditQueryDecisionStatsResponse | undefined
): DecisionStatsSummary => {
  if (!response) return EMPTY_DECISION_STATS;

  return {
    total: response.total ?? 0,
    latest_at_unix: response.latest_at_unix ?? 0,
    filter: {
      flagged: response.filter?.flagged ?? 0,
      blocked: response.filter?.blocked ?? 0,
      block_rate: response.filter?.block_rate ?? 0,
      top_rule_id: response.filter?.top_rule_id ?? '',
      suspicious: response.filter?.suspicious ?? 0,
      hostile: response.filter?.hostile ?? 0,
      top_rules: normalizeLabelCounts(response.filter?.top_rules),
    },
    classifier: {
      responded: response.classifier?.responded ?? 0,
      tagged: response.classifier?.tagged ?? 0,
      top_label: response.classifier?.top_label ?? '',
      avg_tagged_score: response.classifier?.avg_tagged_score ?? 0,
      consensus: response.classifier?.consensus ?? 0,
      labels: normalizeLabelCounts(response.classifier?.labels),
    },
    redactor: {
      redacted: response.redactor?.redacted ?? 0,
      spans: response.redactor?.spans ?? 0,
      redaction_rate: response.redactor?.redaction_rate ?? 0,
      span_labels: normalizeLabelCounts(response.redactor?.span_labels),
    },
  };
};

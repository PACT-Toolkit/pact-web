import { useMemo } from 'react';

import {
  type AuditEvent,
  useQueryAuditEvents,
} from '@/src/__codegen__/rest/audit';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/app/audit/domain/audit_decision_payload';

// Number of most-recent pact.decisions events the console aggregates over.
// Matches the filter workbench window so the two surfaces agree.
const DECISIONS_WINDOW = 200;

// How often the live stream re-polls when the live toggle is on.
export const LIVE_REFRESH_MS = 10_000;

// Labels that mean "no injection detected". Compared case-insensitively so the
// stub engine ("benign") and DeBERTa ("BENIGN") both fold into the benign set.
const BENIGN_LABELS = new Set(['benign', 'none', 'safe', 'clean', '']);

// A named tally used for the per-stage breakdown lists (rule ids, classifier
// labels, PII span labels). Sorted descending by count by the aggregator.
export interface LabelCount {
  label: string;
  count: number;
}

export interface FilterStats {
  /** Decisions in the window where the filter produced a non-safe verdict. */
  flagged: number;
  /** Decisions the gateway ultimately blocked. */
  blocked: number;
  /** blocked / total, as a 0–100 percentage. */
  blockRate: number;
  /** Most frequently matched filter rule id, if any. */
  topRuleId?: string;
  /** Suspicious vs hostile split across the window. */
  suspicious: number;
  hostile: number;
  /** Top matched rule ids with counts (highest first). */
  topRules: LabelCount[];
}

export interface ClassifierStats {
  /** Decisions where the classifier returned a label. */
  responded: number;
  /** Decisions tagged with a non-benign label. */
  tagged: number;
  /** Most frequent non-benign label, if any. */
  topLabel?: string;
  /** Mean score across tagged decisions, as a 0–100 percentage. */
  avgTaggedScore: number;
  /** Decisions arbitrated by pact-consensus (sub-object present, not skipped). */
  consensus: number;
  /** Non-benign label distribution with counts (highest first). */
  labels: LabelCount[];
}

export interface RedactorStats {
  /** Decisions where the redactor removed at least one span. */
  redacted: number;
  /** Total PII spans removed across the window. */
  spans: number;
  /** redacted / total, as a 0–100 percentage. */
  redactionRate: number;
  /** PII span label distribution with counts (highest first). */
  spanLabels: LabelCount[];
}

export interface PipelineStats {
  /** Total decisions considered (window size, capped at DECISIONS_WINDOW). */
  total: number;
  /** ISO timestamp of the newest decision in the window, if any. */
  latestAt?: string;
  filter: FilterStats;
  classifier: ClassifierStats;
  redactor: RedactorStats;
}

// A parsed pact.decisions row: the raw audit event plus its decoded payload.
// Shared by the stage stats and the live stream so the window is parsed once.
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
  BENIGN_LABELS.has(label.toLowerCase());

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

const EMPTY_STATS: PipelineStats = {
  total: 0,
  filter: {
    flagged: 0,
    blocked: 0,
    blockRate: 0,
    suspicious: 0,
    hostile: 0,
    topRules: [],
  },
  classifier: {
    responded: 0,
    tagged: 0,
    avgTaggedScore: 0,
    consensus: 0,
    labels: [],
  },
  redactor: { redacted: 0, spans: 0, redactionRate: 0, spanLabels: [] },
};

// Sort a count map into a descending LabelCount[], keeping the top `limit`.
const topCounts = (
  counts: Record<string, number>,
  limit: number
): LabelCount[] =>
  Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));

export const aggregatePipelineStats = (
  records: DecisionRecord[]
): PipelineStats => {
  if (records.length === 0) return EMPTY_STATS;

  let flagged = 0;
  let blocked = 0;
  let suspicious = 0;
  let hostile = 0;
  let responded = 0;
  let tagged = 0;
  let taggedScoreSum = 0;
  let consensus = 0;
  let redacted = 0;
  let spans = 0;
  const labelCounts: Record<string, number> = {};
  const ruleCounts: Record<string, number> = {};
  const spanLabelCounts: Record<string, number> = {};

  for (const { dp } of records) {
    if (dp.decision === 'block') blocked++;

    const verdict = dp.filter?.verdict?.toLowerCase();
    if (verdict === 'suspicious') suspicious++;
    if (verdict === 'hostile') hostile++;

    if (isFilterFlagged(dp)) {
      flagged++;
      if (dp.filter?.rule_id) {
        ruleCounts[dp.filter.rule_id] =
          (ruleCounts[dp.filter.rule_id] ?? 0) + 1;
      }
    }

    const label = dp.classifier?.label;
    if (label) {
      responded++;
      if (!isBenignLabel(label)) {
        tagged++;
        taggedScoreSum += dp.classifier?.score ?? 0;
        labelCounts[label] = (labelCounts[label] ?? 0) + 1;
      }
    }

    if (dp.consensus && !dp.consensus.skipped) consensus++;

    if (isRedacted(dp)) {
      redacted++;
      spans += dp.redactor?.spans?.length ?? 0;
      for (const span of dp.redactor?.spans ?? []) {
        const key = span.label || 'SPAN';
        spanLabelCounts[key] = (spanLabelCounts[key] ?? 0) + 1;
      }
    }
  }

  const total = records.length;
  const topRules = topCounts(ruleCounts, 3);
  const labels = topCounts(labelCounts, 3);

  return {
    total,
    latestAt: records[0]?.event.createdAt,
    filter: {
      flagged,
      blocked,
      blockRate: total > 0 ? (blocked / total) * 100 : 0,
      topRuleId: topRules[0]?.label,
      suspicious,
      hostile,
      topRules,
    },
    classifier: {
      responded,
      tagged,
      topLabel: labels[0]?.label,
      avgTaggedScore: tagged > 0 ? (taggedScoreSum / tagged) * 100 : 0,
      consensus,
      labels,
    },
    redactor: {
      redacted,
      spans,
      redactionRate: total > 0 ? (redacted / total) * 100 : 0,
      spanLabels: topCounts(spanLabelCounts, 3),
    },
  };
};

/**
 * Single SWR-backed source for the console's stage widgets and live stream.
 * One `pact.decisions` query feeds both; SWR dedupes the request so calling
 * this once in the orchestrator is enough. When `live` is true the window
 * re-polls every LIVE_REFRESH_MS; when false polling is paused.
 */
export const useDashboardPipelineStats = (live: boolean) => {
  const params = useMemo(
    () => ({ topic: 'pact.decisions', limit: DECISIONS_WINDOW }),
    []
  );

  const { data, error, isLoading, isValidating, mutate } = useQueryAuditEvents(
    params,
    {
      swr: {
        refreshInterval: live ? LIVE_REFRESH_MS : 0,
        revalidateOnFocus: false,
        keepPreviousData: true,
      },
    }
  );

  const records = useMemo(
    () => (data?.status === 200 ? parseDecisions(data.data.events) : []),
    [data]
  );

  const stats = useMemo(() => aggregatePipelineStats(records), [records]);

  return { stats, records, error, isLoading, isValidating, mutate };
};

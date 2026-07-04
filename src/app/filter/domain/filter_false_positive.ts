import {
  type AuditEvent,
  type queryAuditEventsResponse,
} from '@/src/__codegen__/rest/audit';
import { type ClassifierLabelVerdictRequest } from '@/src/__codegen__/rest/classifier';
import {
  withFalsePositiveFlag,
  type DecisionPayload,
} from '@/src/app/filter/domain/filter_decision';

// PACT-325 wires FilterDecisionRow's "Flag as false positive" button to
// gateway's POST /v1/classifier/label (PACT-318) so the flag persists
// instead of living in local React state. That endpoint hard-requires a
// non-empty `content` field at runtime (pact-gateway
// internal/features/classifier/handler.go's labelVerdict; the OpenAPI spec
// was caught up to this in PACT-456/commit bf2c77c) -- but pact.decisions
// audit rows never carry raw content by design. pact-gateway's
// internal/kafka/producer.go documents this explicitly on ContentRef: "PACT
// is a redaction system -- raw prompt content is deliberately never
// persisted in the audit trail." ClassifierTestPanel.tsx hit the same wall
// and worked around it by only offering the label action right after an
// operator pastes fresh text; the filter console's rows are historical,
// already-decided rows with no fresh text to offer.
//
// Rather than leaving the button permanently disabled (defeating PACT-325's
// ask), this sends a clearly-marked, non-natural-language placeholder in
// `content` and tags the request with a distinct `source` so anyone curating
// the classifier's fine-tune feedback corpus can filter these rows out --
// they carry no usable training text, only an operator-confirmed FP signal
// against a requestId. predictedLabel is "unknown" (a valid member of the
// classifier's label enum) because the flat filter-stage DecisionPayload
// never carries a classifier label -- the block came from the regex/rule
// engine, not the classifier.
//
// KNOWN LIMITATION (flagged for follow-up, not solved by this change):
// pact-gateway's classifier.LabelVerdict RPC writes only to pact-classifier's
// feedback corpus, never back to pact-audit, and there is no GET endpoint
// that reports which requestIds have already been labeled. Against a real
// pact-gateway today, the write succeeds but the console has no way to read
// the flag back, so it would appear unflagged again after a reload. Durable
// production persistence needs a dedicated audit-side annotation
// capability -- out of scope here.
//
// This repo's dev:mock stands in for that missing read surface (see the
// classifier mock handler): it stamps is_false_positive onto the matching
// db.decisions row for same-tab SWR revalidation, and additionally persists
// the requestId to sessionStorage (filter.ts's
// persistFalsePositiveRequestId/reapplyPersistedFalsePositiveFlags) so the
// flag also survives an actual page reload -- `db` is otherwise a plain
// module-scope object re-seeded from scratch on every full navigation. This
// is a dev:mock-only demo aid with no bearing on the real-gateway limitation
// above.
const FALSE_POSITIVE_SOURCE = 'filter_console_decision_flag';

export const buildFilterFalsePositiveLabelRequest = (
  requestId: string,
  payload: DecisionPayload | null
): ClassifierLabelVerdictRequest => ({
  requestId,
  content: `[content unavailable -- pact.decisions audit rows never retain raw content] rule=${payload?.filter_rule_id ?? 'n/a'} reason=${payload?.reason ?? 'n/a'}`,
  predictedLabel: 'unknown',
  operatorLabel: 'false_positive',
  source: FALSE_POSITIVE_SOURCE,
});

// Resolves the identifier the flag request should key off. Prefers the
// audit row's own requestId (gateway-assigned correlation id) and falls
// back to the payload's own request_id copy for older mock fixtures that
// only ever populated the payload field.
export const resolveFlagRequestId = (
  event: AuditEvent,
  payload: DecisionPayload | null
): string | undefined => event.requestId || payload?.request_id;

// Optimistic-update transform for the SWR cache key backing
// useQueryAuditEvents. Flips the matching event's payloadJson to carry
// is_false_positive: true so the row renders as flagged immediately, before
// the mutation resolves. rollbackOnError (wired at the call site) reverts
// this if the request fails.
export const applyOptimisticFalsePositiveFlag = (
  current: queryAuditEventsResponse | undefined,
  eventId: string
): queryAuditEventsResponse | undefined => {
  if (!current || current.status !== 200) return current;

  return {
    ...current,
    data: {
      ...current.data,
      events: current.data.events.map((event) =>
        event.id === eventId
          ? { ...event, payloadJson: withFalsePositiveFlag(event.payloadJson) }
          : event
      ),
    },
  };
};

export const isFlaggedFalsePositive = (
  payload: DecisionPayload | null
): boolean => payload?.is_false_positive === true;

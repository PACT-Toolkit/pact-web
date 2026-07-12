// pact.decisions payloadJson shape.
//
// Re-exported from the shared decision-vocabulary module rather than
// redeclared (PACT-426) -- the filter console used to hand-roll its own
// narrower DecisionPayload copy here, which had drifted from the real
// pact-gateway/internal/kafka/producer.go shape (it modeled `filter_rule_id`
// as a top-level field; the real wire shape nests it at `filter.rule_id`,
// see pact-contracts' decisions/pact.decisions.schema.json). Reusing the
// generated-backed type in src/lib/decisions/decision_payload.ts (PACT-581)
// means the filter console can never diverge from it again.
//
// PACT-474 note: this used to carry an overlaid is_false_positive?: boolean
// client-side signal, stamped onto payloadJson as a stand-in for durable
// flag persistence. That stand-in is gone -- the flag now lives in
// pact-audit's decision-annotations store (PACT-464) and is read back via
// POST /v1/audit/annotations/query, keyed on requestId, not embedded in
// this payload. See filter_false_positive.ts.
import { parseDecisionPayload } from '@/src/lib/decisions/decision_payload';

export type {
  DecisionPayload,
  FilterDecision,
} from '@/src/lib/decisions/decision_payload';

export const PAGE_SIZE = 25;

export const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const parsePayload = parseDecisionPayload;

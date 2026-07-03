import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/app/audit/domain/audit_decision_payload';

// Re-derived from DecisionPayload rather than redeclared, so the classifier
// feature never drifts from the audit feature's decode of pact-gateway's
// kafka.DecisionEvent.Classifier sub-object (see audit_decision_payload.ts).
// Cross-feature domain imports are allowed by the app/app boundary rule in
// eslint.config.mjs (same pattern as consensus_record.ts / redactor_record.ts).
//
// Note: the sub-object carries only label, score, and engine -- there is no
// enforce_mode (or any per-verdict enforcement-mode) field on the wire.
export type ClassifierSubObject = NonNullable<DecisionPayload['classifier']>;

// Client-side page size for the classifier console (PACT-322), matching the
// sibling pact.decisions consoles (FilterDecisionsWorkbench PAGE_SIZE,
// ConsensusRecord PAGE_SIZE, RedactorRecord PAGE_SIZE).
export const PAGE_SIZE = 25;

// One classifier-stage verdict: the audit event's identity/timing fields
// paired with the decoded classifier sub-object. The classifier stage runs
// on (almost) every /v1/check call (stage 2 of the pipeline), so this is
// expected to track close to the full pact.decisions volume for a given
// fetch window.
export interface ClassifierRecord {
  id: string;
  createdAt: string;
  requestId?: string;
  classifier: ClassifierSubObject;
  // Top-level pipeline decision (allow/block) for the same request --
  // useful context alongside the classifier's own label/score, since a
  // benign classifier label can still be blocked by an earlier filter-stage
  // rule (or vice versa: a flagged classifier label whose request was
  // ultimately allowed after consensus arbitration).
  decision?: string;
  // Whether stage 2.5 (consensus) ran for this request, i.e. the payload
  // carries a `consensus` sub-object -- true only when the classifier score
  // fell below PACT_CONSENSUS_THRESHOLD. Derived, not a field on the wire
  // itself.
  consensusArbitrated: boolean;
  // Whole /v1/check pipeline latency in ms, NOT a classifier-stage-specific
  // duration -- pact-gateway does not emit a per-stage latency, only the
  // end-to-end request latency (mirrors RedactorRecord.latencyMs's and
  // ConsensusRecord.latencyMs's caveat).
  latencyMs?: number;
  // Raw JSONB payload string for the same event, in case a future pass
  // wants a raw-payload fallback like ConsensusRawPayloadToggle's.
  rawPayload: string;
}

// Only events whose decoded payload carries a `classifier` sub-object
// become records -- everything else means the payload predates the
// classifier pipeline stage or failed to decode. Malformed payload JSON
// never throws: parseDecisionPayload returns null and the event is
// skipped, same as a payload with no classifier block.
export const extractClassifierRecords = (
  events: AuditEvent[]
): ClassifierRecord[] => {
  const records: ClassifierRecord[] = [];

  for (const event of events) {
    const payload = parseDecisionPayload(event.payloadJson);
    if (!payload?.classifier) continue;

    records.push({
      id: event.id,
      createdAt: event.createdAt,
      requestId: event.requestId,
      classifier: payload.classifier,
      decision: payload.decision,
      consensusArbitrated: Boolean(payload.consensus),
      latencyMs: payload.latency_ms,
      rawPayload: event.payloadJson,
    });
  }

  return records;
};

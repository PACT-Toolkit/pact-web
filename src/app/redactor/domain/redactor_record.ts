import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/app/audit/domain/audit_decision_payload';

// Re-derived from DecisionPayload rather than redeclared, so the redactor
// feature never drifts from the audit feature's decode of pact-gateway's
// kafka.DecisionEvent.Redactor sub-object (see audit_decision_payload.ts).
// Cross-feature domain imports are allowed by the app/app boundary rule in
// eslint.config.mjs (same pattern as consensus_record.ts).
export type RedactorSubObject = NonNullable<DecisionPayload['redactor']>;
export type RedactorSpan = NonNullable<RedactorSubObject['spans']>[number];

// Client-side page size for the redactor console (PACT-324), matching the
// sibling pact.decisions consoles (FilterDecisionsWorkbench PAGE_SIZE,
// ConsensusRecord PAGE_SIZE).
export const PAGE_SIZE = 25;

// One redactor-stage decision: the audit event's identity/timing fields
// paired with the decoded redactor sub-object. Unlike consensus (which only
// escalates a minority of requests past the classifier), the redactor stage
// runs on every /v1/check call, so most pact.decisions rows carry a
// redactor sub-object -- pass_through as often as redacted.
export interface RedactorRecord {
  id: string;
  createdAt: string;
  requestId?: string;
  redactor: RedactorSubObject;
  // Whole-pipeline engine tag (kafka.DecisionEvent.Engine). Not a
  // redactor-specific field -- the redactor sub-object itself carries no
  // engine of its own (see audit_decision_payload.ts, where only the
  // classifier sub-object and the top-level payload have an `engine`).
  // Additive; absent on older payloads.
  engine?: string;
  // Whole /v1/check pipeline latency in ms, NOT a redactor-stage-specific
  // duration -- pact-gateway does not emit a per-stage latency, only the
  // end-to-end request latency (mirrors ConsensusRecord.latencyMs's
  // caveat).
  latencyMs?: number;
  // Raw JSONB payload string for the same event, in case a future pass
  // wants a raw-payload fallback like ConsensusRawPayloadToggle's.
  rawPayload: string;
}

// Only events whose decoded payload carries a `redactor` sub-object become
// records -- everything else means the payload predates the redactor
// pipeline stage or failed to decode. Malformed payload JSON never throws:
// parseDecisionPayload returns null and the event is skipped, same as a
// payload with no redactor block.
export const extractRedactorRecords = (
  events: AuditEvent[]
): RedactorRecord[] => {
  const records: RedactorRecord[] = [];

  for (const event of events) {
    const payload = parseDecisionPayload(event.payloadJson);
    if (!payload?.redactor) continue;

    records.push({
      id: event.id,
      createdAt: event.createdAt,
      requestId: event.requestId,
      redactor: payload.redactor,
      engine: payload.engine,
      latencyMs: payload.latency_ms,
      rawPayload: event.payloadJson,
    });
  }

  return records;
};

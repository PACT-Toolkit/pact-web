import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/app/audit/domain/audit_decision_payload';

// Re-derived from DecisionPayload rather than redeclared, so the consensus
// feature never drifts from the audit feature's decode of pact-gateway's
// kafka.ConsensusDecision (see audit_decision_payload.ts). Cross-feature
// domain imports are allowed by the app/app boundary rule in
// eslint.config.mjs.
export type ConsensusSubObject = NonNullable<DecisionPayload['consensus']>;
export type ConsensusVote = NonNullable<ConsensusSubObject['votes']>[number];

// One arbitrated request: the audit event's identity/timing fields paired
// with the decoded consensus sub-object (and classifier engine, for
// context on which model triggered the stage 2.5 escalation).
export interface ConsensusRecord {
  id: string;
  createdAt: string;
  requestId?: string;
  consensus: ConsensusSubObject;
  // Additive (PACT-328) -- absent on pre-PACT-328 payloads.
  classifierEngine?: string;
  // Whole /v1/check pipeline latency in ms, NOT a consensus-stage-specific
  // duration -- pact-gateway does not emit a per-stage latency, only the
  // end-to-end request latency (kafka.DecisionEvent.LatencyMs). Rendered as
  // "Request latency" in the UI, never as "consensus latency".
  latencyMs?: number;
}

// Only events whose decoded payload carries a `consensus` sub-object become
// records -- everything else means stage 2.5 didn't run for that request
// (classifier score >= PACT_CONSENSUS_THRESHOLD). Malformed payload JSON
// never throws: parseDecisionPayload returns null and the event is skipped,
// same as a payload with no consensus block.
export const extractConsensusRecords = (
  events: AuditEvent[]
): ConsensusRecord[] => {
  const records: ConsensusRecord[] = [];

  for (const event of events) {
    const payload = parseDecisionPayload(event.payloadJson);
    if (!payload?.consensus) continue;

    records.push({
      id: event.id,
      createdAt: event.createdAt,
      requestId: event.requestId,
      consensus: payload.consensus,
      classifierEngine: payload.classifier?.engine,
      latencyMs: payload.latency_ms,
    });
  }

  return records;
};

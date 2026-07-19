import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/lib/decisions/decision_payload';

// The identity/timing fields every stage console's record shares, lifted
// straight off the audit event.
export type StageRecordBase = {
  id: string;
  createdAt: string;
  requestId?: string;
  // Whole /v1/check pipeline latency in ms, NOT a stage-specific duration --
  // pact-gateway does not emit a per-stage latency, only the end-to-end
  // request latency (kafka.DecisionEvent.LatencyMs). Render as request
  // latency, never as a per-stage one.
  latencyMs?: number;
  // Raw JSONB payload string for the same event, so consoles can offer the
  // raw-JSON fallback /audit has without re-fetching the event.
  rawPayload: string;
};

// The parse -> guard -> project loop shared by the classifier, consensus,
// and redactor consoles. Only events whose decoded payload has the stage's
// sub-object (returned by `pick`) become records -- anything else means the
// stage didn't run for that request or the payload predates the stage.
// Malformed payload JSON never throws: parseDecisionPayload returns null
// and the event is skipped, same as a payload without the sub-object.
export const extractStageRecords = <TSubObject, TExtra>(
  events: AuditEvent[],
  pick: (payload: DecisionPayload) => TSubObject | undefined,
  project: (subObject: TSubObject, payload: DecisionPayload) => TExtra
): (StageRecordBase & TExtra)[] => {
  const records: (StageRecordBase & TExtra)[] = [];

  for (const event of events) {
    const payload = parseDecisionPayload(event.payloadJson);
    if (!payload) continue;
    const subObject = pick(payload);
    if (!subObject) continue;

    records.push({
      id: event.id,
      createdAt: event.createdAt,
      requestId: event.requestId,
      latencyMs: payload.latency_ms,
      rawPayload: event.payloadJson,
      ...project(subObject, payload),
    });
  }

  return records;
};

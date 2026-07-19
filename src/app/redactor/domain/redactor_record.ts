import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';
import {
  extractStageRecords,
  type StageRecordBase,
} from '@/src/lib/decisions/extract_stage_records';

// Re-derived from DecisionPayload rather than redeclared, so the redactor
// feature never drifts from the canonical decode of pact-gateway's
// kafka.DecisionEvent.Redactor sub-object (see
// src/lib/decisions/decision_payload.ts).
export type RedactorSubObject = NonNullable<DecisionPayload['redactor']>;
export type RedactorSpan = NonNullable<RedactorSubObject['spans']>[number];

// Client-side page size for the redactor console (PACT-324), matching the
// sibling pact.decisions consoles (FilterDecisionsWorkbench PAGE_SIZE,
// ConsensusRecord PAGE_SIZE).
export const PAGE_SIZE = 25;

// One redactor-stage decision: the shared audit-event identity/timing
// fields paired with the decoded redactor sub-object. Unlike consensus
// (which only escalates a minority of requests past the classifier), the
// redactor stage runs on every /v1/check call, so most pact.decisions rows
// carry a redactor sub-object -- pass_through as often as redacted.
export interface RedactorRecord extends StageRecordBase {
  redactor: RedactorSubObject;
  // Whole-pipeline engine tag (kafka.DecisionEvent.Engine). Not a
  // redactor-specific field -- the redactor sub-object itself carries no
  // engine of its own (see src/lib/decisions/decision_payload.ts, where only
  // the classifier sub-object and the top-level payload have an `engine`).
  // Additive; absent on older payloads.
  engine?: string;
}

// Only events whose decoded payload carries a `redactor` sub-object become
// records -- everything else means the payload predates the redactor
// pipeline stage or failed to decode. See extractStageRecords for the
// shared guard and malformed-payload semantics.
export const extractRedactorRecords = (
  events: AuditEvent[]
): RedactorRecord[] =>
  extractStageRecords(
    events,
    (payload) => payload.redactor,
    (redactor, payload) => ({
      redactor,
      engine: payload.engine,
    })
  );

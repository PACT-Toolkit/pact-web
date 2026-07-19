import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';
import {
  extractStageRecords,
  type StageRecordBase,
} from '@/src/lib/decisions/extract_stage_records';

// Re-derived from DecisionPayload rather than redeclared, so the classifier
// feature never drifts from the canonical decode of pact-gateway's
// kafka.DecisionEvent.Classifier sub-object (see
// src/lib/decisions/decision_payload.ts).
//
// Note: the sub-object carries only label, score, and engine -- there is no
// enforce_mode (or any per-verdict enforcement-mode) field on the wire.
export type ClassifierSubObject = NonNullable<DecisionPayload['classifier']>;

// Client-side page size for the classifier console (PACT-322), matching the
// sibling pact.decisions consoles (FilterDecisionsWorkbench PAGE_SIZE,
// ConsensusRecord PAGE_SIZE, RedactorRecord PAGE_SIZE).
export const PAGE_SIZE = 25;

// One classifier-stage verdict: the shared audit-event identity/timing
// fields paired with the decoded classifier sub-object. The classifier
// stage runs on (almost) every /v1/check call (stage 2 of the pipeline),
// so this is expected to track close to the full pact.decisions volume for
// a given fetch window.
export interface ClassifierRecord extends StageRecordBase {
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
}

// Only events whose decoded payload carries a `classifier` sub-object
// become records -- see extractStageRecords for the shared guard and
// malformed-payload semantics.
export const extractClassifierRecords = (
  events: AuditEvent[]
): ClassifierRecord[] =>
  extractStageRecords(
    events,
    (payload) => payload.classifier,
    (classifier, payload) => ({
      classifier,
      decision: payload.decision,
      consensusArbitrated: Boolean(payload.consensus),
    })
  );

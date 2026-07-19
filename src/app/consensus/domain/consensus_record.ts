import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';
import {
  extractStageRecords,
  type StageRecordBase,
} from '@/src/lib/decisions/extract_stage_records';

// Re-derived from DecisionPayload rather than redeclared, so the consensus
// feature never drifts from the canonical decode of pact-gateway's
// kafka.ConsensusDecision (see src/lib/decisions/decision_payload.ts).
export type ConsensusSubObject = NonNullable<DecisionPayload['consensus']>;
export type ConsensusVote = NonNullable<ConsensusSubObject['votes']>[number];

// Client-side page size for the consensus console (PACT-369). Distinct from
// the fixed fetch window in ConsensusWorkbench.tsx (FETCH_WINDOW_SIZE):
// that constant bounds the single SWR request against the server-side
// clamp, this one bounds how many already-fetched records are shown per
// page. Co-located with ConsensusRecord for the same reason
// filter_decision.ts keeps PAGE_SIZE next to DecisionPayload -- the two are
// defined together and read together.
export const PAGE_SIZE = 25;

// One arbitrated request: the shared audit-event identity/timing fields
// paired with the decoded consensus sub-object (and classifier engine, for
// context on which model triggered the stage 2.5 escalation).
export interface ConsensusRecord extends StageRecordBase {
  consensus: ConsensusSubObject;
  // Additive (PACT-328) -- absent on pre-PACT-328 payloads.
  classifierEngine?: string;
}

// Only events whose decoded payload carries a `consensus` sub-object become
// records -- everything else means stage 2.5 didn't run for that request
// (classifier score >= PACT_CONSENSUS_THRESHOLD). See extractStageRecords
// for the shared guard and malformed-payload semantics.
export const extractConsensusRecords = (
  events: AuditEvent[]
): ConsensusRecord[] =>
  extractStageRecords(
    events,
    (payload) => payload.consensus,
    (consensus, payload) => ({
      consensus,
      classifierEngine: payload.classifier?.engine,
    })
  );

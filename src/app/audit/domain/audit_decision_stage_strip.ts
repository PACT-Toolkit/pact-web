import {
  PIPELINE_STAGE_ORDER,
  type PipelineStageId,
} from '@/src/framework/decisions/pipeline_stage';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

// Whether each pipeline stage's sub-object is present on this payload --
// presence, not a nested verdict field, is the "did this stage run" signal,
// mirroring how test_lab_check.ts's deriveLayerDefinitions treats
// `external_refs` as the sandbox-ran signal. There is no per-stage
// pass/fail field common to every sub-object (filter has `verdict`,
// consensus has `quorum_reached`, classifier has neither), so a stage is
// shown as "ran" once its sub-object exists and "blocked" only when it is
// the one `engine` names -- never a second, invented verdict.
const STAGE_PRESENT: Record<
  PipelineStageId,
  (payload: DecisionPayload) => boolean
> = {
  filter: (payload) => payload.filter !== undefined,
  classifier: (payload) => payload.classifier !== undefined,
  sandbox: (payload) => payload.external_refs !== undefined,
  consensus: (payload) => payload.consensus !== undefined,
  redactor: (payload) => payload.redactor !== undefined,
};

// Derives the audit stage strip's entries from a decisions payload: every
// visualised stage with a present sub-object, in pipeline order, the one
// named by `engine` marked as the blocker (PACT-748). `engine` stays the
// single stage-attribution authority the PACT-745 badge already uses -- no
// parallel mapping is introduced here.
//
// Returns [] when the payload carries no per-stage sub-objects at all
// (older events, or a decision the gateway never attributed) -- callers
// render nothing in that case rather than a placeholder, and StageStrip
// itself also treats an empty list as "render nothing" so this is
// belt-and-suspenders, not the only guard.
export const derivePipelineStages = (
  payload: DecisionPayload
): { id: PipelineStageId; blocked: boolean }[] =>
  PIPELINE_STAGE_ORDER.filter((id) => STAGE_PRESENT[id](payload)).map((id) => ({
    id,
    blocked: payload.decision === 'block' && payload.engine === id,
  }));

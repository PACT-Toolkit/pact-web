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

// Wall-clock milliseconds the gateway spent in each visualised stage, read
// from the stage sub-object's `duration_ms`. Only a finite number above zero
// counts: absent (older events) and zero both mean "no timing to show".
const STAGE_DURATION_MS: Record<
  PipelineStageId,
  (payload: DecisionPayload) => number | undefined
> = {
  filter: (payload) => payload.filter?.duration_ms,
  classifier: (payload) => payload.classifier?.duration_ms,
  sandbox: (payload) => payload.external_refs?.duration_ms,
  consensus: (payload) => payload.consensus?.duration_ms,
  redactor: (payload) => payload.redactor?.duration_ms,
};

const usableDuration = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : undefined;

// Derives the audit stage strip's entries from a decisions payload: every
// visualised stage with a present sub-object, in pipeline order, the one
// named by `engine` marked as the blocker and each carrying the stage's own
// duration when the gateway reported one. `engine` stays the
// single stage-attribution authority the blocked-by badge already uses -- no
// parallel mapping is introduced here.
//
// Returns [] when the payload carries no per-stage sub-objects at all
// (older events, or a decision the gateway never attributed) -- callers
// render nothing in that case rather than a placeholder, and StageStrip
// itself also treats an empty list as "render nothing" so this is
// belt-and-suspenders, not the only guard.
export const derivePipelineStages = (
  payload: DecisionPayload
): { id: PipelineStageId; blocked: boolean; durationMs?: number }[] =>
  PIPELINE_STAGE_ORDER.filter((id) => STAGE_PRESENT[id](payload)).map((id) => {
    const durationMs = usableDuration(STAGE_DURATION_MS[id](payload));

    return {
      id,
      blocked: payload.decision === 'block' && payload.engine === id,
      ...(durationMs !== undefined && { durationMs }),
    };
  });

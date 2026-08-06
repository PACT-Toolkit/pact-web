import { type CelDecision } from '@/src/lib/decisions/decision_payload';

// Human labels for CelDecision.skipped_reason (celeval.SkipReason* constants,
// see decisions.ts's CelDecision doc comment) -- present only when the CEL
// stage could not fully evaluate every active rule (fail-open: the stage ran
// but hit a budget or a runtime error on at least one rule). Mirrors how
// AuditDecisionInsights's consensus.skipped branch documents fail-open
// behaviour via a tooltip, but CEL's skip carries three distinct reasons
// instead of one boolean, so it needs its own label map rather than a single
// string.
const CEL_SKIPPED_REASON_LABELS: Record<
  NonNullable<CelDecision['skipped_reason']>,
  string
> = {
  cel_stage_timeout: 'stage timeout',
  cel_rule_timeout: 'rule timeout',
  cel_rule_error: 'rule error',
};

// Returns undefined for an absent reason so callers can gate rendering on
// the return value directly, same shape as the rest of this payload's
// optional sub-fields.
export const celSkippedReasonLabel = (
  reason: CelDecision['skipped_reason']
): string | undefined =>
  reason ? CEL_SKIPPED_REASON_LABELS[reason] : undefined;

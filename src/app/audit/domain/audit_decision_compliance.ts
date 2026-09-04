import { type ComplianceDecision } from '@/src/lib/decisions/decision_payload';

// Human labels for ComplianceDecision.verdict -- see decisions.ts's
// ComplianceDecision doc comment. The compliance stage is the gateway's
// deferred shadow check (shadow is always true today): it scores whether the
// user message deviates from the system prompt, but the verdict is advisory
// only and must never be shown as the cause of a block -- see
// decision_stage_attribution.ts's STAGE_ATTRIBUTED_ENGINES, which excludes
// "compliance" from the engine closed set for the same reason.
const COMPLIANCE_VERDICT_LABELS: Record<
  NonNullable<ComplianceDecision['verdict']>,
  string
> = {
  compliant: 'Compliant',
  deviating: 'Deviating',
};

// Returns undefined for an absent verdict so callers can gate rendering on
// the return value directly, same shape as celSkippedReasonLabel.
export const complianceVerdictLabel = (
  verdict: ComplianceDecision['verdict']
): string | undefined =>
  verdict ? COMPLIANCE_VERDICT_LABELS[verdict] : undefined;

export type ComplianceBadgeTone = 'emerald' | 'amber';

// score is the engine's P(deviating) in [0, 1], so "compliant" is the
// good/expected outcome (emerald, matching consensus's quorum-reached tone)
// and "deviating" is the risk signal (amber, matching consensus's
// no-quorum tone and filter's shadow pill). An absent verdict (skipped)
// never reaches this helper -- callers gate on verdict presence first.
export const complianceBadgeTone = (
  verdict: NonNullable<ComplianceDecision['verdict']>
): ComplianceBadgeTone => (verdict === 'deviating' ? 'amber' : 'emerald');

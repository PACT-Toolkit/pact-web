import { type DecisionPayload } from '@/src/app/audit/domain/audit_decision_payload';
import { type CheckResponse } from '@/src/app/test_lab/domain/test_lab_check';

export const CHECK_ENDPOINT = '/api/pact/gateway/v1/check';
export const CORPUS_ENDPOINT = '/api/pact/benchmark/v1/corpus';

export interface CheckRequest {
  content: string;
  kind: 'input';
}

export interface CorpusCaptureRequest {
  content: string;
  attack_type: string;
  reason?: string;
  filter_rule_id?: string;
}

// Maps a /v1/check response onto the looser audit DecisionPayload so the probe
// result reuses AuditDecisionInsights — the exact renderer the live stream and
// the activity log use, keeping verdict presentation consistent everywhere.
// The verdict/label string spaces already match (both lower-case on the wire).
export const checkResponseToDecisionPayload = (
  data: CheckResponse
): DecisionPayload => ({
  decision: data.decision,
  reason: data.reason,
  filter: data.filter,
  classifier: data.classifier,
  redactor: data.redactor,
});

import { type DecisionPayload } from '@/src/app/audit/domain/audit_decision_payload';
import { type CheckResponse } from '@/src/app/test_lab/domain/test_lab_check';

// PACT-465 moved corpus save from the direct pact-benchmark proxy onto the
// gateway edge proxy (see src/app/test_lab/domain/test_lab_check.ts and
// app/api/pact/gateway/v1/benchmark/corpus/route.ts). The dashboard's quick
// probe shares this same save-to-corpus surface with Test Lab.
export const CORPUS_ENDPOINT = '/api/pact/gateway/v1/benchmark/corpus';

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

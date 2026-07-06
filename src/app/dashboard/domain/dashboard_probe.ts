import {
  type DecisionPayload,
  type FilterDecision,
  type RedactorDecision,
} from '@/src/app/audit/domain/audit_decision_payload';
import { type CheckResponse } from '@/src/app/test_lab/domain/test_lab_check';

// PACT-465 moved corpus save from the direct pact-benchmark proxy onto the
// gateway edge proxy (see src/app/test_lab/domain/test_lab_check.ts and
// app/api/pact/gateway/v1/benchmark/corpus/route.ts). The dashboard's quick
// probe shares this same save-to-corpus surface with Test Lab.
export const CORPUS_ENDPOINT = '/api/pact/gateway/v1/benchmark/corpus';

// Maps a /v1/check response onto the audit DecisionPayload so the probe
// result reuses AuditDecisionInsights - the exact renderer the live stream and
// the activity log use, keeping verdict presentation consistent everywhere.
// The verdict/label string spaces already match (both lower-case on the wire).
//
// data.filter/data.redactor come from the /v1/check OpenAPI contract
// (CheckFilterInfo/CheckRedactorInfo, schema/check via orval), a distinct,
// swagger-generated wire type from the pact.decisions Kafka schema
// (PACT-426) DecisionPayload is now generated from. Both describe the same
// closed verdict vocabularies (pipeline.Decision.FilterVerdict /
// RedactorVerdict - see each field's doc comment on both sides), but orval
// doesn't extract swagger's string-with-enum-in-description as a TS literal
// union the way json-schema-to-typescript does for this schema, so
// data.filter.verdict/data.redactor.verdict type as plain `string` there.
// The `as` casts below narrow to the DecisionPayload literal unions; they
// don't change runtime values, only the static type, and are safe because
// both contracts share the same underlying pipeline verdict values.
//
// latency_ms is intentionally left off this mapping: DashboardQuickProbe.tsx
// already renders result.latency_ms in its own badge row right above where
// this payload feeds AuditDecisionInsights, so adding it here would render
// "Request latency" a second time.
export const checkResponseToDecisionPayload = (
  data: CheckResponse
): DecisionPayload => ({
  decision: data.decision,
  reason: data.reason,
  filter: data.filter && {
    verdict: data.filter.verdict as FilterDecision['verdict'],
    rule_id: data.filter.rule_id,
    shadow: data.filter.shadow,
  },
  classifier: data.classifier,
  redactor: data.redactor && {
    verdict: data.redactor.verdict as RedactorDecision['verdict'],
    spans: data.redactor.spans,
  },
});

import { type CheckResponse } from '@/src/app/test_lab/domain/test_lab_check';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

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
// RedactorVerdict - see each field's doc comment on both sides).
//
// Pre-PACT-576, orval didn't extract swagger's string-with-enum-in-description
// as a TS literal union the way json-schema-to-typescript does for the
// pact-decisions schema, so data.filter.verdict/data.redactor.verdict typed as
// plain `string` here and needed an `as FilterDecision['verdict']` cast to
// narrow. pact-gateway PR #134 added swaggo `enums:` tags to those fields, so
// orval now emits the same literal unions (CheckFilterInfoVerdict /
// CheckRedactorInfoVerdict) -- the two contracts' verdict fields are
// structurally identical types now, so no cast is needed. The values
// themselves are also runtime-checked before `data` ever reaches this
// function: see parseCheckResponse in test_lab_check.ts, called at both of
// this payload's producers (useTestLabRun.runCheck, DashboardQuickProbe).
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
    verdict: data.filter.verdict,
    rule_id: data.filter.rule_id,
    shadow: data.filter.shadow,
  },
  classifier: data.classifier,
  redactor: data.redactor && {
    verdict: data.redactor.verdict,
    spans: data.redactor.spans,
  },
});

import {
  type PactDecisions,
  type ClassifierDecision,
  type ConsensusDecision,
  type FilterDecision,
  type ModelVote,
  type PolicyDecision,
  type RedactedSpan,
  type RedactorDecision,
} from '@/src/__codegen__/schema/pact-decisions';

// Re-exported so consumers that only need a sub-object's shape (e.g. a cast
// off a different wire contract, see dashboard_probe.ts) don't have to reach
// past this domain module into the generated codegen directory directly.
export type {
  ClassifierDecision,
  ConsensusDecision,
  FilterDecision,
  ModelVote,
  PolicyDecision,
  RedactedSpan,
  RedactorDecision,
};

// Shape of kafka.DecisionEvent fields surfaced in the audit UI, generated
// from pact-contracts' decisions/pact.decisions.schema.json (PACT-426) --
// see src/__codegen__/schema/pact-decisions/. Matches pact-gateway
// internal/kafka/producer.go; decoded lazily.
//
// Partial<>, not the bare generated PactDecisions: the wire schema marks
// event_uuid/request_id/decision/latency_ms/created_at as required (they are
// always present on a real Kafka payload), but this type is also used to
// type payload *drafts* being built up incrementally -- mock seed data
// (consensus.ts/redactor.ts's SCENARIOS, filter.ts) and
// dashboard_probe.ts's bridge from the /v1/check REST response, both of
// which assemble a payload in stages before the identity/timing fields are
// known. Every sub-object field keeps its precise generated shape (closed
// enums included) -- only top-level presence is relaxed, preserving the
// original "permissive against schema additions" intent this type has always
// had while gaining the schema's real field names and enum values.
//
// The shape here intentionally duplicates the stricter typing in
// src/app/test_lab/domain/test_lab_check.ts (CheckFilterInfo /
// CheckRedactorInfo / CheckRedactedSpan). The Test Lab consumes the /v1/check
// REST response (OpenAPI-generated, a distinct wire contract); the audit
// feed consumes pact.decisions JSONB payloads (this schema). See PACT-426's
// "out of scope" note -- the two are never unified.
export type DecisionPayload = Partial<PactDecisions>;

export const parseDecisionPayload = (raw: string): DecisionPayload | null => {
  try {
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null;

    return p as DecisionPayload;
  } catch {
    return null;
  }
};

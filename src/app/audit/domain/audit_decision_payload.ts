// Shape of kafka.DecisionEvent fields surfaced in the audit UI.
// Matches pact-gateway internal/kafka/producer.go — decoded lazily;
// unknown/missing fields are tolerated per the audit schema contract.
//
// The shape here intentionally duplicates the stricter typing in
// src/app/test_lab/domain/test_lab_check.ts (FilterInfo / RedactorInfo /
// RedactedSpan). The Test Lab consumes a known-good /v1/check response;
// the audit feed consumes JSONB payloads from pact-audit that may include
// fields we don't yet model. Looser types here keep the UI permissive
// against schema additions without a deploy.
export interface DecisionPayload {
  decision?: string;
  reason?: string;
  engine?: string;
  filter?: { verdict?: string; rule_id?: string; shadow?: boolean };
  classifier?: { label?: string; score?: number };
  redactor?: {
    verdict?: string;
    spans?: { start?: number; end?: number; label?: string }[];
  };
  policy?: { verdict?: string; agent_id?: string; tool_id?: string };
}

export const parseDecisionPayload = (raw: string): DecisionPayload | null => {
  try {
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null;

    return p as DecisionPayload;
  } catch {
    return null;
  }
};

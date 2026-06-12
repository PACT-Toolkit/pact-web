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
  // Forensic-trace block (gateway PACT-265): lets an operator pivot a single
  // decision back to the actor and session that produced it. All optional —
  // absent on pre-PACT-265 payloads, and partially absent on pre-pipeline
  // rejections (no session_id/content). session_id is a SHA-256 fingerprint of
  // the bearer (never the token); content is a hash of the prompt (never the
  // prompt). user_id rides at the row level (AuditEvent), not here.
  session_id?: string;
  client_ip?: string;
  user_agent?: string;
  conversation_id?: string;
  content?: { sha256?: string; bytes?: number };
  filter?: { verdict?: string; rule_id?: string; shadow?: boolean };
  classifier?: { label?: string; score?: number };
  redactor?: {
    verdict?: string;
    spans?: { start?: number; end?: number; label?: string }[];
  };
  // Consensus sub-object (gateway kafka.ConsensusDecision): present only when
  // classifier score was below PACT_CONSENSUS_THRESHOLD and stage 2.5 ran.
  // Absent on pre-PACT-217 payloads and on requests that didn't trip the
  // threshold. `skipped: true` signals a transport fail-open where consensus
  // couldn't be reached and the original classifier result was preserved.
  consensus?: {
    label?: string;
    confidence?: number;
    quorum_reached?: boolean;
    backend_count?: number;
    skipped?: boolean;
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

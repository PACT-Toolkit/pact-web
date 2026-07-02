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
  classifier?: {
    label?: string;
    score?: number;
    // Free-form model/checkpoint tag the classifier engine reported for this
    // verdict (e.g. "stub-v1", "deberta-prompt-injection-v2@abcd1234").
    // Additive (PACT-328, mirrors gateway kafka.ClassifierDecision.Engine) --
    // absent when the engine did not report one.
    engine?: string;
  };
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
    // Per-model breakdown behind label/backend_count (PACT-328, mirrors
    // gateway kafka.ConsensusDecision.Votes). Additive -- absent when the
    // consensus stage didn't run or returned no per-model votes (e.g. a
    // transport-error fail-open, where skipped=true and votes is omitted).
    votes?: { backend_id?: string; label?: string; score?: number }[];
  };
  policy?: { verdict?: string; agent_id?: string; tool_id?: string };
  // Whole /v1/check pipeline latency in ms (gateway kafka.DecisionEvent.
  // LatencyMs). This is end-to-end request latency, not scoped to any single
  // pipeline stage -- there is no per-stage (e.g. consensus-only) duration on
  // the wire. Additive here since earlier consumers of DecisionPayload never
  // needed it; the consensus console (PACT-323) is the first to surface it,
  // labeled "Request latency" rather than implying it's consensus-specific.
  latency_ms?: number;
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

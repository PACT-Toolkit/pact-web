// Shape of kafka.DecisionEvent fields surfaced in the audit UI.
// Matches pact-gateway internal/kafka/producer.go — decoded lazily;
// unknown/missing fields are tolerated per the audit schema contract.
export interface DecisionPayload {
  decision?: string;
  reason?: string;
  engine?: string;
  filter?: { verdict?: string; rule_id?: string; shadow?: boolean };
  classifier?: { label?: string; score?: number };
  redactor?: { verdict?: string };
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

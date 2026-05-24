// pact.decisions payloadJson shape.
// Defined here because the gateway owns this schema (kafka/producer.go)
// and there is no codegen for it today.
export interface DecisionPayload {
  request_id: string;
  decision: 'allow' | 'block';
  reason?: string;
  filter_rule_id?: string;
  latency_ms: number;
}

export const PAGE_SIZE = 25;

export const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

export const parsePayload = (raw: string): DecisionPayload | null => {
  try {
    return JSON.parse(raw) as DecisionPayload;
  } catch {
    return null;
  }
};

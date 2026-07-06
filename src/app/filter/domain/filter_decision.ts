// pact.decisions payloadJson shape.
// Defined here because the gateway owns this schema (kafka/producer.go)
// and there is no codegen for it today.
//
// PACT-474 note: this used to carry an overlaid is_false_positive?: boolean
// client-side signal, stamped onto payloadJson as a stand-in for durable
// flag persistence. That stand-in is gone -- the flag now lives in
// pact-audit's decision-annotations store (PACT-464) and is read back via
// POST /v1/audit/annotations/query, keyed on requestId, not embedded in
// this payload. See filter_false_positive.ts.
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

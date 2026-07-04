// pact.decisions payloadJson shape.
// Defined here because the gateway owns this schema (kafka/producer.go)
// and there is no codegen for it today.
export interface DecisionPayload {
  request_id: string;
  decision: 'allow' | 'block';
  reason?: string;
  filter_rule_id?: string;
  latency_ms: number;
  // Overlaid client-side signal (PACT-325): true once an operator has
  // confirmed this blocked decision was a false positive via
  // FilterDecisionRow's flag button. Not part of the real gateway's
  // DecisionEvent schema -- see filter_false_positive.ts's docblock for why
  // this only round-trips through this repo's MSW mock today.
  is_false_positive?: boolean;
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

// Stamps is_false_positive: true onto a decision's raw payloadJson string.
// Shared by the optimistic SWR update (filter_false_positive.ts) and the
// classifier mock handler that persists the flag onto db.decisions, so both
// sides of the optimistic-update/revalidate round trip agree on the exact
// shape. Falls back to the original string if it isn't valid JSON -- a
// malformed payload should never crash the flag action.
export const withFalsePositiveFlag = (payloadJson: string): string => {
  const payload = parsePayload(payloadJson);
  if (!payload) return payloadJson;

  return JSON.stringify({ ...payload, is_false_positive: true });
};

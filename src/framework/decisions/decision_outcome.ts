import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

// How a decision outcome is presented. The wire enum is closed (allow, block,
// canceled) but parsed JSON is not validated against it, so anything else
// falls into the neutral 'unknown' tone: an unrecognised outcome must never
// read as an allow.
export type DecisionTone = 'allow' | 'block' | 'canceled' | 'unknown';

export const decisionTone = (decision: string | undefined): DecisionTone => {
  switch (decision) {
    case 'allow':
    case 'block':
    case 'canceled':
      return decision;
    default:
      return 'unknown';
  }
};

const DECISION_LABEL: Record<Exclude<DecisionTone, 'unknown'>, string> = {
  allow: 'Allow',
  block: 'Block',
  canceled: 'Canceled',
};

// Display label for a decision outcome: the friendly label for the known
// values, the verbatim wire string for anything else.
export const decisionLabel = (decision: string): string => {
  const tone = decisionTone(decision);

  return tone === 'unknown' ? decision : DECISION_LABEL[tone];
};

// Plain-words explanation of the machine reasons that need one. Only the
// canceled outcome has a dedicated reason today; every other reason code is
// shown verbatim next to the badge.
const REASON_DESCRIPTION: Record<string, string> = {
  client_canceled: 'Caller disconnected before a verdict',
};

export const decisionReasonDescription = (
  payload: DecisionPayload
): string | undefined =>
  payload.decision === 'canceled' || payload.reason === 'client_canceled'
    ? REASON_DESCRIPTION.client_canceled
    : REASON_DESCRIPTION[payload.reason ?? ''];

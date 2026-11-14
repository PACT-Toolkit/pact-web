import { INPUT_TOO_LARGE_REASON } from '@/src/framework/decisions/input_too_large';
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

// Plain-words explanation of the machine reasons that need one (the canceled
// outcome and the classifier's oversize and saturation blocks); every other
// reason code is shown verbatim next to the badge. A Map, not an object
// literal: reason is wire data, and a plain-object lookup would also match
// inherited keys such as "constructor".
const CLIENT_CANCELED_DESCRIPTION = 'Caller disconnected before a verdict';
// Shared with the Test Lab's classifier layer so both views word the
// gateway's oversize block identically.
export const CLASSIFIER_INPUT_TOO_LARGE_DESCRIPTION =
  "Input exceeds the classifier's size limit - fail closed";
// The gateway answers a shed classifier with a retryable 429 (Retry-After),
// so the block is transient and the wording tells the operator to retry.
export const CLASSIFIER_SATURATED_DESCRIPTION =
  'Classifier at capacity - retry later';
// The gateway's single input ceiling answers HTTP 413 before any stage runs;
// the audit log still records that request as a block.
const INPUT_TOO_LARGE_DESCRIPTION =
  'Input exceeds the gateway size limit - rejected before any stage ran';
const REASON_DESCRIPTION = new Map<string, string>([
  [INPUT_TOO_LARGE_REASON, INPUT_TOO_LARGE_DESCRIPTION],
  ['client_canceled', CLIENT_CANCELED_DESCRIPTION],
  ['classifier_input_too_large', CLASSIFIER_INPUT_TOO_LARGE_DESCRIPTION],
  ['classifier_saturated', CLASSIFIER_SATURATED_DESCRIPTION],
]);

// Plain-words text for a bare reason code, for callers that hold a reason
// without a whole DecisionPayload (the files list's scan verdict).
// undefined means the code has no friendly wording: show it verbatim.
export const reasonCodeDescription = (
  reason: string | undefined
): string | undefined => REASON_DESCRIPTION.get(reason ?? '');

export const decisionReasonDescription = (
  payload: DecisionPayload
): string | undefined =>
  payload.decision === 'canceled'
    ? CLIENT_CANCELED_DESCRIPTION
    : reasonCodeDescription(payload.reason);

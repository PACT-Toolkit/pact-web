import {
  type CheckCheckResponse,
  type CheckRedactorInfo,
} from '@/src/__codegen__/rest/check';

// A /v1/check response only ever carries redactor.spans/verdict when the
// pipeline actually reached stage 4 -- an earlier stage (filter, classifier,
// consensus, sandbox) can halt the pipeline first, in which case the
// response comes back 200 with a decision (usually "block") and reason, but
// no `redactor` sub-object at all (PACT-913: consensus_enforced observed in
// dev:real). RedactorTestPanel used to treat that shape as an empty result
// (verdict "unknown", 0 spans, masked output == raw input) instead of the
// distinct "never ran" state it actually is.
export type RedactorTestOutcome =
  | { kind: 'masked'; redactor: CheckRedactorInfo }
  | { kind: 'blocked_upstream'; reason?: string };

// classifyRedactorTestOutcome distinguishes a genuine redactor-stage result
// from an upstream block that short-circuited the pipeline before the
// redactor stage ran. Blocked whenever the decision is "block" OR the
// `redactor` sub-object is absent -- either signal alone means there is no
// redactor verdict/spans to render, so treating only one of them as blocked
// would still mis-render the other combination.
export const classifyRedactorTestOutcome = (
  data: CheckCheckResponse
): RedactorTestOutcome => {
  if (data.decision === 'block' || !data.redactor) {
    return { kind: 'blocked_upstream', reason: data.reason };
  }

  return { kind: 'masked', redactor: data.redactor };
};

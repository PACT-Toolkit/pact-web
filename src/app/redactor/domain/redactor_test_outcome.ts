import {
  type CheckCheckResponse,
  type CheckRedactorInfo,
} from '@/src/__codegen__/rest/check';

// pact-gateway's pipeline runs its stages in a fixed order (pact-gateway
// internal/pipeline/service.go + stages.go, verified at master fa13a28):
// policy, filter, classifier, compliance, sandbox, consensus, redactor,
// toolMitigation, cel. The check handler only emits `resp.redactor` when the
// redactor stage actually ran (its verdict is non-empty -- including
// "unknown" on a transport fail-open) -- so `redactor` present/absent is the
// only reliable "did this stage run" signal, not `decision`:
//
// - decision alone does not imply the redactor ran or didn't. A classifier
//   transport failure halts the pipeline *before* the redactor stage with an
//   *allow* verdict and reason "classifier_unreachable" (stages.go:326-334)
//   -- allow with no redactor object is a real, common shape.
// - the CEL stage runs *after* the redactor and can escalate an allow to a
//   block. So "block" with a redactor object present is also real: the
//   redactor ran, produced genuine spans/masked output, and CEL blocked the
//   request afterward. That output is still useful to an operator and must
//   not be hidden.
//
// RedactorTestPanel used to classify purely on `decision === 'block'`,
// which mislabeled both of the shapes above.
export type RedactorTestOutcome =
  | {
      kind: 'ran';
      redactor: CheckRedactorInfo;
      blocked: boolean;
      reason?: string;
    }
  | {
      kind: 'not_run';
      decision: CheckCheckResponse['decision'];
      reason?: string;
    };

// classifyRedactorTestOutcome distinguishes a genuine redactor-stage result
// from a pipeline that halted (or never reached the redactor) before that
// stage ran. The `redactor` sub-object's presence is the sole signal: it
// exists iff the redactor stage ran, regardless of the final decision.
export const classifyRedactorTestOutcome = (
  data: CheckCheckResponse
): RedactorTestOutcome => {
  if (data.redactor) {
    return {
      kind: 'ran',
      redactor: data.redactor,
      blocked: data.decision === 'block',
      reason: data.reason,
    };
  }

  return { kind: 'not_run', decision: data.decision, reason: data.reason };
};

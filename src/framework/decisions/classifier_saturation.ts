import {
  type CheckCheckResponse,
  CheckCheckResponseDecision,
} from '@/src/__codegen__/rest/check';

export const CLASSIFIER_SATURATED_REASON = 'classifier_saturated';

// The gateway's classifier_saturated block is the one decision it answers with
// a retryable 429 and an error body ({code, error}) instead of a 200 decision
// (internal/features/check/handler.go). Callers of /v1/check (Test Lab, the
// dashboard quick probe) still show it as a classifier block, so the 429 is
// lifted into the decision shape here rather than surfacing as a generic
// failed check. Returns undefined for any other response.
export const checkResponseFromSaturation = (
  response: { status: number; data: unknown },
  latencyMs: number
): CheckCheckResponse | undefined => {
  const { data } = response;
  if (
    response.status !== 429 ||
    typeof data !== 'object' ||
    data === null ||
    (data as { code?: unknown }).code !== CLASSIFIER_SATURATED_REASON
  ) {
    return undefined;
  }

  return {
    // The 429 body carries no request id; the audit event holds the real one.
    request_id: '',
    decision: CheckCheckResponseDecision.block,
    reason: CLASSIFIER_SATURATED_REASON,
    latency_ms: latencyMs,
  };
};

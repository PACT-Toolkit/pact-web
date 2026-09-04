import { describe, expect, it } from 'vitest';

import { type CheckCheckResponse } from '@/src/__codegen__/rest/check';
import { classifyRedactorTestOutcome } from '@/src/app/redactor/domain/redactor_test_outcome';

const baseResponse: CheckCheckResponse = {
  decision: 'allow',
  latency_ms: 42,
  request_id: 'req-1',
};

describe('classifyRedactorTestOutcome', () => {
  it('classifies allow with a redactor object as ran/not-blocked', () => {
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      decision: 'allow',
      redactor: { verdict: 'redacted', spans: [{ start: 0, end: 5 }] },
    });

    expect(outcome).toEqual({
      kind: 'ran',
      redactor: { verdict: 'redacted', spans: [{ start: 0, end: 5 }] },
      blocked: false,
      reason: undefined,
    });
  });

  it('classifies a benign pass-through with an empty span list as ran/not-blocked', () => {
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      redactor: { verdict: 'pass_through', spans: [] },
    });

    expect(outcome.kind).toBe('ran');
    if (outcome.kind === 'ran') expect(outcome.blocked).toBe(false);
  });

  it('classifies allow with no redactor object as not_run (classifier_unreachable shape)', () => {
    // A classifier transport failure halts the pipeline *before* the
    // redactor stage with an allow verdict and reason
    // "classifier_unreachable" (pact-gateway stages.go:326-334) -- a real,
    // common shape, not a defensive edge case.
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      decision: 'allow',
      reason: 'classifier_unreachable',
    });

    expect(outcome).toEqual({
      kind: 'not_run',
      decision: 'allow',
      reason: 'classifier_unreachable',
    });
  });

  it('classifies block with no redactor object as not_run', () => {
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      decision: 'block',
      reason: 'consensus_enforced',
    });

    expect(outcome).toEqual({
      kind: 'not_run',
      decision: 'block',
      reason: 'consensus_enforced',
    });
  });

  it('classifies block with a redactor object as ran/blocked', () => {
    // The redactor stage runs before CEL, which can escalate an earlier
    // allow to a block (e.g. filter_hostile alongside a redacted API_KEY
    // span, see redactor.ts's fourth mock scenario). The redactor's
    // spans/masked output are genuine and must still be rendered, alongside
    // a blocked indicator -- not hidden behind a "did not run" message.
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      decision: 'block',
      reason: 'filter_hostile',
      redactor: { verdict: 'redacted', spans: [{ start: 0, end: 3 }] },
    });

    expect(outcome).toEqual({
      kind: 'ran',
      redactor: { verdict: 'redacted', spans: [{ start: 0, end: 3 }] },
      blocked: true,
      reason: 'filter_hostile',
    });
  });
});

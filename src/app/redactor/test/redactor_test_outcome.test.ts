import { describe, expect, it } from 'vitest';

import { type CheckCheckResponse } from '@/src/__codegen__/rest/check';
import { classifyRedactorTestOutcome } from '@/src/app/redactor/domain/redactor_test_outcome';

const baseResponse: CheckCheckResponse = {
  decision: 'allow',
  latency_ms: 42,
  request_id: 'req-1',
};

describe('classifyRedactorTestOutcome', () => {
  it('classifies a genuine redactor result as masked', () => {
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      redactor: { verdict: 'redacted', spans: [{ start: 0, end: 5 }] },
    });

    expect(outcome).toEqual({
      kind: 'masked',
      redactor: { verdict: 'redacted', spans: [{ start: 0, end: 5 }] },
    });
  });

  it('classifies a benign pass-through with an empty span list as masked', () => {
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      redactor: { verdict: 'pass_through', spans: [] },
    });

    expect(outcome.kind).toBe('masked');
  });

  it('classifies a block decision with no redactor object as blocked upstream', () => {
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      decision: 'block',
      reason: 'consensus_enforced',
    });

    expect(outcome).toEqual({
      kind: 'blocked_upstream',
      reason: 'consensus_enforced',
    });
  });

  it('classifies an allow decision with no redactor object as blocked upstream too', () => {
    // Defensive: an "allow" with no redactor sub-object still has no
    // verdict/spans to render, so it must not fall through to the masked
    // branch and read undefined fields off a missing object.
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      decision: 'allow',
    });

    expect(outcome).toEqual({ kind: 'blocked_upstream', reason: undefined });
  });

  it('classifies a block decision that still carries a redactor object as blocked upstream', () => {
    // The redactor stage can run and still be overridden by a later block
    // (e.g. filter_hostile alongside a redacted API_KEY span, see
    // redactor.ts's fourth mock scenario) -- decision === 'block' always wins
    // over a present redactor object, since the panel's blocked-state
    // messaging (not the masked preview) is what a blocked request needs.
    const outcome = classifyRedactorTestOutcome({
      ...baseResponse,
      decision: 'block',
      reason: 'filter_hostile',
      redactor: { verdict: 'redacted', spans: [{ start: 0, end: 3 }] },
    });

    expect(outcome).toEqual({
      kind: 'blocked_upstream',
      reason: 'filter_hostile',
    });
  });
});

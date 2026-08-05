import { describe, expect, it } from 'vitest';

import { isStageAttributed } from '@/src/lib/decisions/decision_stage_attribution';

describe('isStageAttributed', () => {
  it.each([
    'filter',
    'classifier',
    'consensus',
    'redactor',
    'sandbox',
  ] as const)(
    'is true for engine=%s (maps to a visualised pipeline stage)',
    (engine) => {
      expect(isStageAttributed({ decision: 'block', engine })).toBe(true);
    }
  );

  it.each(['policy', 'gateway', 'cel'] as const)(
    'is false for engine=%s (no visualised-stage mapping, PACT-749)',
    (engine) => {
      expect(isStageAttributed({ decision: 'block', engine })).toBe(false);
    }
  );

  it('is false when engine is absent entirely (pre-PACT-745 payloads)', () => {
    expect(isStageAttributed({ decision: 'block' })).toBe(false);
  });

  it('does not gate on decision or the presence of causal_spans -- callers decide when to call it', () => {
    expect(
      isStageAttributed({
        decision: 'block',
        engine: 'cel',
        diagnostics: { causal_spans: [{ start: 0, end: 5 }] },
      })
    ).toBe(false);
    expect(
      isStageAttributed({
        decision: 'block',
        engine: 'filter',
        diagnostics: { causal_spans: [{ start: 0, end: 5 }] },
      })
    ).toBe(true);
  });
});

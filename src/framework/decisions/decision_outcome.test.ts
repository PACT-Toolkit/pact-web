import { describe, expect, it } from 'vitest';

import {
  decisionLabel,
  decisionReasonDescription,
  decisionTone,
} from '@/src/framework/decisions/decision_outcome';

describe('decisionTone', () => {
  it('maps the three wire outcomes to themselves', () => {
    expect(decisionTone('allow')).toBe('allow');
    expect(decisionTone('block')).toBe('block');
    expect(decisionTone('canceled')).toBe('canceled');
  });

  it('never maps canceled, an unknown value or an absent value to allow', () => {
    expect(decisionTone('canceled')).not.toBe('allow');
    expect(decisionTone('cancelled')).toBe('unknown');
    expect(decisionTone('')).toBe('unknown');
    expect(decisionTone(undefined)).toBe('unknown');
  });
});

describe('decisionLabel', () => {
  it('uses friendly labels for known outcomes and the raw string otherwise', () => {
    expect(decisionLabel('canceled')).toBe('Canceled');
    expect(decisionLabel('allow')).toBe('Allow');
    expect(decisionLabel('mystery')).toBe('mystery');
  });
});

describe('decisionReasonDescription', () => {
  it('explains client_canceled in plain words', () => {
    expect(
      decisionReasonDescription({
        decision: 'canceled',
        reason: 'client_canceled',
      })
    ).toBe('Caller disconnected before a verdict');
  });

  it('has no description for ordinary reasons', () => {
    expect(
      decisionReasonDescription({ decision: 'block', reason: 'filter_hostile' })
    ).toBeUndefined();
  });
});

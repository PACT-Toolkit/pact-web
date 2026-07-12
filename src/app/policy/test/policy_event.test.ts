import { describe, expect, it } from 'vitest';

import {
  isPolicyEventDenied,
  policyEventVerdict,
  type PolicyEvent,
} from '@/src/app/policy/domain/policy_event';

const event = (overrides: Partial<PolicyEvent> = {}): PolicyEvent => ({
  id: 'evt-1',
  requestId: 'req-1',
  createdAt: '2026-07-01T00:00:00Z',
  decision: 'allow',
  ...overrides,
});

describe('isPolicyEventDenied', () => {
  it('is true for a block decision', () => {
    expect(isPolicyEventDenied(event({ decision: 'block' }))).toBe(true);
  });

  it('is false for an allow decision', () => {
    expect(isPolicyEventDenied(event({ decision: 'allow' }))).toBe(false);
  });
});

describe('policyEventVerdict', () => {
  it('prefers the nested policy.verdict when present', () => {
    expect(
      policyEventVerdict(
        event({ decision: 'allow', policy: { verdict: 'allowed' } })
      )
    ).toBe('allowed');
    expect(
      policyEventVerdict(
        event({ decision: 'block', policy: { verdict: 'denied' } })
      )
    ).toBe('denied');
  });

  it('falls back to the top-level decision when policy is absent', () => {
    expect(policyEventVerdict(event({ decision: 'block' }))).toBe('denied');
    expect(policyEventVerdict(event({ decision: 'allow' }))).toBe('allowed');
  });
});

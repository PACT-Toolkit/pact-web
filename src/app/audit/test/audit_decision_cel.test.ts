import { describe, expect, it } from 'vitest';

import { celSkippedReasonLabel } from '@/src/app/audit/domain/audit_decision_cel';

describe('celSkippedReasonLabel', () => {
  it.each([
    ['cel_stage_timeout', 'stage timeout'],
    ['cel_rule_timeout', 'rule timeout'],
    ['cel_rule_error', 'rule error'],
  ] as const)('maps %s to "%s"', (reason, expected) => {
    expect(celSkippedReasonLabel(reason)).toBe(expected);
  });

  it('returns undefined when no skipped_reason is present', () => {
    expect(celSkippedReasonLabel(undefined)).toBeUndefined();
  });
});

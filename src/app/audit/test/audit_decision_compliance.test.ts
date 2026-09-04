import { describe, expect, it } from 'vitest';

import {
  complianceBadgeTone,
  complianceVerdictLabel,
} from '@/src/app/audit/domain/audit_decision_compliance';

describe('complianceVerdictLabel', () => {
  it.each([
    ['compliant', 'Compliant'],
    ['deviating', 'Deviating'],
  ] as const)('maps %s to "%s"', (verdict, expected) => {
    expect(complianceVerdictLabel(verdict)).toBe(expected);
  });

  it('returns undefined when no verdict is present', () => {
    expect(complianceVerdictLabel(undefined)).toBeUndefined();
  });
});

describe('complianceBadgeTone', () => {
  it('tones "compliant" as emerald (the good/expected outcome)', () => {
    expect(complianceBadgeTone('compliant')).toBe('emerald');
  });

  it('tones "deviating" as amber (the risk signal)', () => {
    expect(complianceBadgeTone('deviating')).toBe('amber');
  });
});

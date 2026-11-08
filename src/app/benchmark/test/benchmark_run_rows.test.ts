import { describe, expect, it } from 'vitest';

import {
  RUN_ROW_OUTCOME_ALL,
  RUN_ROW_OUTCOMES,
  isMitigatedRow,
  rowVerdictKind,
} from '@/src/app/benchmark/domain/benchmark_run_rows';

describe('rowVerdictKind', () => {
  it('treats a plain row as a verdict', () => {
    expect(rowVerdictKind({})).toBe('verdict');
    expect(rowVerdictKind({ throttled: false, unscored: false })).toBe(
      'verdict'
    );
  });

  it('classifies a row by the single flag it carries', () => {
    expect(rowVerdictKind({ error: 'upstream timeout' })).toBe('error');
    expect(rowVerdictKind({ throttled: true })).toBe('throttled');
    expect(rowVerdictKind({ unscored: true })).toBe('unscored');
  });

  it('ranks error above throttled above unscored', () => {
    expect(
      rowVerdictKind({ error: 'boom', throttled: true, unscored: true })
    ).toBe('error');
    expect(rowVerdictKind({ throttled: true, unscored: true })).toBe(
      'throttled'
    );
  });

  it('does not treat an empty error string as an error', () => {
    expect(rowVerdictKind({ error: '', unscored: true })).toBe('unscored');
  });
});

describe('RUN_ROW_OUTCOMES', () => {
  it('leads with the all option and lists the API outcome classes', () => {
    expect(RUN_ROW_OUTCOMES[0].value).toBe(RUN_ROW_OUTCOME_ALL);
    expect(RUN_ROW_OUTCOMES.slice(1).map((o) => o.value)).toEqual([
      'false_negative',
      'false_positive',
      'error',
      'unscored',
      'mitigated',
    ]);
  });
});

describe('isMitigatedRow', () => {
  it('is true for an allow the redactor masked', () => {
    expect(isMitigatedRow({ decision: 'allow', redacted: true })).toBe(true);
  });

  it('is true for an allow with the classifier_mitigated reason and no redacted flag', () => {
    expect(
      isMitigatedRow({
        decision: 'allow',
        redacted: false,
        reason: 'classifier_mitigated',
      })
    ).toBe(true);
    expect(
      isMitigatedRow({ decision: 'allow', reason: 'classifier_mitigated' })
    ).toBe(true);
  });

  it('is false for a plain allow, another reason or a missing decision', () => {
    expect(isMitigatedRow({ decision: 'allow' })).toBe(false);
    expect(
      isMitigatedRow({
        decision: 'allow',
        reason: 'classifier found no injection',
      })
    ).toBe(false);
    expect(isMitigatedRow({ redacted: true })).toBe(false);
  });

  it('is false for a block, even a redacted or classifier_mitigated one', () => {
    expect(isMitigatedRow({ decision: 'block', redacted: true })).toBe(false);
    expect(
      isMitigatedRow({ decision: 'block', reason: 'classifier_mitigated' })
    ).toBe(false);
  });
});

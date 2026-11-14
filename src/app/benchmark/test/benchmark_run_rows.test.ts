import { describe, expect, it } from 'vitest';

import {
  RUN_ROW_OUTCOME_ALL,
  RUN_ROW_OUTCOMES,
  PROMPT_NOT_STORED_EXPLANATION,
  PROMPT_PREVIEW_EXPAND_THRESHOLD,
  isMitigatedRow,
  rowAttemptsMarker,
  rowPromptDisplay,
  rowVerdictKind,
} from '@/src/app/benchmark/domain/benchmark_run_rows';

describe('rowPromptDisplay', () => {
  it('reports a missing prompt for the empty legacy marker and an absent field', () => {
    for (const preview of ['', undefined]) {
      expect(rowPromptDisplay(preview)).toEqual({
        kind: 'missing',
        label: 'not stored',
        explanation: PROMPT_NOT_STORED_EXPLANATION,
      });
    }
  });

  it('keeps a short preview as is and not expandable', () => {
    expect(rowPromptDisplay('What is a mutex?')).toEqual({
      kind: 'stored',
      text: 'What is a mutex?',
      expandable: false,
    });
  });

  it('makes a preview over the threshold expandable, at the boundary', () => {
    const atLimit = 'a'.repeat(PROMPT_PREVIEW_EXPAND_THRESHOLD);

    expect(rowPromptDisplay(atLimit)).toMatchObject({ expandable: false });
    expect(rowPromptDisplay(`${atLimit}b`)).toMatchObject({ expandable: true });
  });

  it('does not alter markup-looking text', () => {
    const text = '<b>hi</b> **bold**';

    expect(rowPromptDisplay(text)).toMatchObject({ kind: 'stored', text });
  });
});

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

describe('rowAttemptsMarker', () => {
  it('shows nothing for a row that went through first time or has no record', () => {
    expect(rowAttemptsMarker(undefined)).toBeNull();
    expect(rowAttemptsMarker(0)).toBeNull();
    expect(rowAttemptsMarker(1)).toBeNull();
  });

  it('names the extra requests of a retried row', () => {
    expect(rowAttemptsMarker(2)).toEqual({
      text: '×2',
      title: 'needed 2 requests (requeued 1 time)',
    });
    expect(rowAttemptsMarker(5)).toEqual({
      text: '×5',
      title: 'needed 5 requests (requeued 4 times)',
    });
  });
});

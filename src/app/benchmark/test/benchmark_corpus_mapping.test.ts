import { describe, expect, it } from 'vitest';

import {
  computeDistinctLabelValues,
  detectDefaultColumnMapping,
  matchLabelVocabulary,
  normalizeCorpus,
  stringifyLabelValue,
  truncateForPreview,
} from '@/src/app/benchmark/domain/benchmark_corpus_mapping';

describe('detectDefaultColumnMapping', () => {
  it('pre-selects the canonical content/expected_label columns', () => {
    expect(detectDefaultColumnMapping(['content', 'expected_label'])).toEqual({
      textColumn: 'content',
      labelColumn: 'expected_label',
    });
  });

  it('pre-selects an aliased text and label column', () => {
    expect(detectDefaultColumnMapping(['prompt', 'is_injection'])).toEqual({
      textColumn: 'prompt',
      labelColumn: 'is_injection',
    });
  });

  it('matches column names case-insensitively', () => {
    expect(detectDefaultColumnMapping(['Text', 'Label'])).toEqual({
      textColumn: 'Text',
      labelColumn: 'Label',
    });
  });

  it('returns null for a column with no alias match', () => {
    expect(detectDefaultColumnMapping(['foo', 'bar'])).toEqual({
      textColumn: null,
      labelColumn: null,
    });
  });

  it('prefers the highest-priority alias when multiple columns match', () => {
    expect(detectDefaultColumnMapping(['label', 'expected_label'])).toEqual({
      textColumn: null,
      labelColumn: 'expected_label',
    });
  });
});

describe('stringifyLabelValue', () => {
  it('stringifies numbers', () => {
    expect(stringifyLabelValue(1)).toBe('1');
    expect(stringifyLabelValue(0)).toBe('0');
  });

  it('stringifies booleans', () => {
    expect(stringifyLabelValue(true)).toBe('true');
    expect(stringifyLabelValue(false)).toBe('false');
  });

  it('trims strings', () => {
    expect(stringifyLabelValue('  block  ')).toBe('block');
  });

  it('returns an empty string for null/undefined', () => {
    expect(stringifyLabelValue(null)).toBe('');
    expect(stringifyLabelValue(undefined)).toBe('');
  });
});

describe('matchLabelVocabulary', () => {
  it.each(['block', '1', 'true', 'injection', 'malicious', 'attack'])(
    'maps "%s" to block',
    (value) => {
      expect(matchLabelVocabulary(value)).toBe('block');
    }
  );

  it.each(['allow', '0', 'false', 'benign', 'safe', 'harmless'])(
    'maps "%s" to allow',
    (value) => {
      expect(matchLabelVocabulary(value)).toBe('allow');
    }
  );

  it('is case-insensitive and whitespace-trimmed', () => {
    expect(matchLabelVocabulary('  BLOCK  ')).toBe('block');
    expect(matchLabelVocabulary('Allow')).toBe('allow');
  });

  it('defaults an unknown value to skip', () => {
    expect(matchLabelVocabulary('maybe')).toBe('skip');
  });
});

describe('computeDistinctLabelValues', () => {
  it('collects distinct values in first-seen order with vocabulary defaults', () => {
    const rows = [
      { label: 'allow' },
      { label: 'block' },
      { label: 'allow' },
      { label: 'unknown' },
    ];

    const result = computeDistinctLabelValues(rows, 'label');

    expect(result).toEqual({
      ok: true,
      values: ['allow', 'block', 'unknown'],
      defaultDecisions: { allow: 'allow', block: 'block', unknown: 'skip' },
    });
  });

  it('stringifies numeric/boolean values before deduping', () => {
    const rows = [{ label: 1 }, { label: 0 }, { label: 1 }];
    const result = computeDistinctLabelValues(rows, 'label');
    expect(result).toEqual({
      ok: true,
      values: ['1', '0'],
      defaultDecisions: { '1': 'block', '0': 'allow' },
    });
  });

  it('errors when there are more than 20 distinct values', () => {
    const rows = Array.from({ length: 21 }, (_, i) => ({ label: `v${i}` }));
    const result = computeDistinctLabelValues(rows, 'label');
    expect(result).toEqual({
      ok: false,
      error: 'label column has too many distinct values',
    });
  });

  it('accepts exactly 20 distinct values', () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({ label: `v${i}` }));
    const result = computeDistinctLabelValues(rows, 'label');
    expect(result.ok).toBe(true);
  });
});

describe('normalizeCorpus', () => {
  const mapping = (
    valueDecisions: Record<string, 'block' | 'allow' | 'skip'>
  ) => ({
    textColumn: 'text',
    labelColumn: 'label',
    valueDecisions,
  });

  it('generates row-NNNNN ids when the source has no id column', () => {
    const parsed = {
      columns: ['text', 'label'],
      rows: [
        { text: 'hello', label: 'allow' },
        { text: 'world', label: 'block' },
      ],
    };

    const result = normalizeCorpus(
      parsed,
      mapping({ allow: 'allow', block: 'block' })
    );

    expect(result.rows).toEqual([
      {
        id: 'row-00001',
        content: 'hello',
        kind: 'input',
        expected_label: 'allow',
      },
      {
        id: 'row-00002',
        content: 'world',
        kind: 'input',
        expected_label: 'block',
      },
    ]);
    expect(result.totals).toEqual({
      total: 2,
      attacks: 1,
      benign: 1,
      skipped: 0,
    });
  });

  it('uses the source id when present and non-empty', () => {
    const parsed = {
      columns: ['id', 'text', 'label'],
      rows: [{ id: 'custom-1', text: 'hello', label: 'allow' }],
    };

    const result = normalizeCorpus(parsed, mapping({ allow: 'allow' }));

    expect(result.rows[0].id).toBe('custom-1');
  });

  it('generates an id when the id column is present but blank', () => {
    const parsed = {
      columns: ['id', 'text', 'label'],
      rows: [{ id: '', text: 'hello', label: 'allow' }],
    };

    const result = normalizeCorpus(parsed, mapping({ allow: 'allow' }));

    expect(result.rows[0].id).toBe('row-00001');
  });

  it('passes category through when present', () => {
    const parsed = {
      columns: ['text', 'label', 'category'],
      rows: [{ text: 'hello', label: 'block', category: 'jailbreak' }],
    };

    const result = normalizeCorpus(parsed, mapping({ block: 'block' }));

    expect(result.rows[0]).toEqual({
      id: 'row-00001',
      content: 'hello',
      kind: 'input',
      expected_label: 'block',
      category: 'jailbreak',
    });
  });

  it('drops rows whose value maps to skip, but still counts them', () => {
    const parsed = {
      columns: ['text', 'label'],
      rows: [
        { text: 'hello', label: 'allow' },
        { text: 'maybe', label: 'unsure' },
      ],
    };

    const result = normalizeCorpus(
      parsed,
      mapping({ allow: 'allow', unsure: 'skip' })
    );

    expect(result.rows).toHaveLength(1);
    expect(result.totals).toEqual({
      total: 2,
      attacks: 0,
      benign: 1,
      skipped: 1,
    });
  });

  it('defaults an unmapped value to skip', () => {
    const parsed = {
      columns: ['text', 'label'],
      rows: [{ text: 'hello', label: 'allow' }],
    };

    const result = normalizeCorpus(parsed, mapping({}));

    expect(result.rows).toHaveLength(0);
    expect(result.totals.skipped).toBe(1);
  });

  it('produces canonical JSONL text, one row per line', () => {
    const parsed = {
      columns: ['text', 'label'],
      rows: [
        { text: 'hello', label: 'allow' },
        { text: 'world', label: 'block' },
      ],
    };

    const result = normalizeCorpus(
      parsed,
      mapping({ allow: 'allow', block: 'block' })
    );

    const lines = result.jsonl.trimEnd().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0])).toEqual(result.rows[0]);
    expect(JSON.parse(lines[1])).toEqual(result.rows[1]);
  });

  it('produces an empty string when every row is skipped', () => {
    const parsed = {
      columns: ['text', 'label'],
      rows: [{ text: 'hello', label: 'unsure' }],
    };
    const result = normalizeCorpus(parsed, mapping({ unsure: 'skip' }));
    expect(result.jsonl).toBe('');
  });
});

describe('truncateForPreview', () => {
  it('leaves short text untouched', () => {
    expect(truncateForPreview('hello')).toBe('hello');
  });

  it('truncates long text and appends an ellipsis', () => {
    const text = 'a'.repeat(100);
    const result = truncateForPreview(text, 10);
    expect(result).toBe(`${'a'.repeat(10)}…`);
  });
});

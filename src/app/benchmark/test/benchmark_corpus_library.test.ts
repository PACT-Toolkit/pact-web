import { describe, expect, it } from 'vitest';

import {
  benchmarkCorpusDatasetRole,
  countEvaluationOnlyDatasets,
  formatCorpusRowCount,
} from '@/src/app/benchmark/domain/benchmark_corpus_library';

describe('formatCorpusRowCount', () => {
  it('formats large counts with thousands separators', () => {
    expect(formatCorpusRowCount(575643)).toBe('575,643');
  });

  it('formats small counts without separators', () => {
    expect(formatCorpusRowCount(45)).toBe('45');
  });

  it('formats zero', () => {
    expect(formatCorpusRowCount(0)).toBe('0');
  });
});

describe('benchmarkCorpusDatasetRole', () => {
  it('reads training', () => {
    expect(benchmarkCorpusDatasetRole({ role: 'training' })).toBe('training');
  });

  it('reads evaluation', () => {
    expect(benchmarkCorpusDatasetRole({ role: 'evaluation' })).toBe(
      'evaluation'
    );
  });

  it('treats an empty string as unknown (not-yet-backfilled)', () => {
    expect(benchmarkCorpusDatasetRole({ role: '' })).toBe('unknown');
  });

  it('treats a missing role as unknown', () => {
    expect(benchmarkCorpusDatasetRole({ role: undefined })).toBe('unknown');
  });

  it('treats an unrecognized value as unknown rather than throwing', () => {
    expect(benchmarkCorpusDatasetRole({ role: 'holdout' })).toBe('unknown');
  });
});

describe('countEvaluationOnlyDatasets', () => {
  it('counts only evaluation-role datasets', () => {
    expect(
      countEvaluationOnlyDatasets([
        { role: 'training' },
        { role: 'evaluation' },
        { role: '' },
        { role: 'evaluation' },
      ])
    ).toBe(2);
  });

  it('returns 0 for an empty list', () => {
    expect(countEvaluationOnlyDatasets([])).toBe(0);
  });
});

import { describe, expect, it } from 'vitest';

import { formatCorpusRowCount } from '@/src/app/benchmark/domain/benchmark_corpus_library';

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

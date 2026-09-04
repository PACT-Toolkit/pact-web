import { describe, expect, it } from 'vitest';

import { type BenchmarkCorpusDataset } from '@/src/app/benchmark/domain/benchmark_corpus_library';
import { corpusComposition } from '@/src/app/benchmark/domain/corpus_composition';

function makeDataset(
  overrides: Partial<BenchmarkCorpusDataset>
): BenchmarkCorpusDataset {
  return {
    source_dataset: 'org/dataset',
    license: 'MIT',
    category: 'mixed-injection',
    total_rows: 100,
    block_rows: 60,
    allow_rows: 40,
    role: 'training',
    ...overrides,
  };
}

describe('corpusComposition', () => {
  it('returns an empty array for no datasets', () => {
    expect(corpusComposition([])).toEqual([]);
  });

  it('preserves input order without re-sorting', () => {
    const small = makeDataset({ source_dataset: 'a/small', total_rows: 10 });
    const large = makeDataset({ source_dataset: 'b/large', total_rows: 1000 });

    const result = corpusComposition([small, large]);

    expect(result.map((r) => r.source_dataset)).toEqual(['a/small', 'b/large']);
  });

  it('splits block/allow rows into percentages that sum to exactly 100', () => {
    const dataset = makeDataset({ block_rows: 1, allow_rows: 2 });

    const [row] = corpusComposition([dataset]);

    expect(row.blockPercent).toBeCloseTo(33.3, 5);
    expect(row.allowPercent).toBeCloseTo(66.7, 5);
    expect(row.blockPercent + row.allowPercent).toBe(100);
  });

  it('returns 0/0 percentages for a zero-row dataset instead of dividing by zero', () => {
    const dataset = makeDataset({
      total_rows: 0,
      block_rows: 0,
      allow_rows: 0,
    });

    const [row] = corpusComposition([dataset]);

    expect(row.blockPercent).toBe(0);
    expect(row.allowPercent).toBe(0);
  });

  it('gives a 100%-block bar for an allow-free dataset', () => {
    const dataset = makeDataset({ block_rows: 50, allow_rows: 0 });

    const [row] = corpusComposition([dataset]);

    expect(row.blockPercent).toBe(100);
    expect(row.allowPercent).toBe(0);
  });

  it('gives a 100%-allow bar for a block-free dataset', () => {
    const dataset = makeDataset({ block_rows: 0, allow_rows: 50 });

    const [row] = corpusComposition([dataset]);

    expect(row.blockPercent).toBe(0);
    expect(row.allowPercent).toBe(100);
  });

  it('carries name, category, license, role, and total_rows through', () => {
    const dataset = makeDataset({
      source_dataset: 'x/y',
      category: 'jailbreak',
      license: 'CC0-1.0',
      total_rows: 250,
      role: 'evaluation',
    });

    const [row] = corpusComposition([dataset]);

    expect(row.source_dataset).toBe('x/y');
    expect(row.category).toBe('jailbreak');
    expect(row.license).toBe('CC0-1.0');
    expect(row.total_rows).toBe(250);
    expect(row.role).toBe('evaluation');
  });

  it('resolves an empty wire role to the "unknown" display role', () => {
    const dataset = makeDataset({ role: '' });

    const [row] = corpusComposition([dataset]);

    expect(row.role).toBe('unknown');
  });
});

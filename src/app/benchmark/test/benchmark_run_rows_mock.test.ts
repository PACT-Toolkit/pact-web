import { describe, expect, it } from 'vitest';

import { MOCK_RUNS } from '@/src/app/benchmark/mock/data/benchmark';
import {
  buildMockRunRows,
  mockRunRows,
  rowMatchesOutcome,
} from '@/src/app/benchmark/mock/data/benchmark_run_rows';

const run11 = MOCK_RUNS.find((r) => r.id === 'run-11')!;

describe('mock run rows', () => {
  it('generates exactly row_count rows with sequential seq numbers', () => {
    const rows = mockRunRows('run-11')!;

    expect(rows).toHaveLength(run11.row_count);
    expect(rows.map((r) => r.seq)).toEqual(
      Array.from({ length: run11.row_count }, (_, i) => i + 1)
    );
  });

  it('is deterministic and cached per run id', () => {
    expect(buildMockRunRows(run11, 7)).toEqual(buildMockRunRows(run11, 7));
    expect(mockRunRows('run-11')).toBe(mockRunRows('run-11'));
  });

  it('returns undefined for an unknown run id', () => {
    expect(mockRunRows('run-missing')).toBeUndefined();
  });

  it('matches the unscored count of the run and gives those rows no classifier score', () => {
    const unscored = mockRunRows('run-11')!.filter((r) =>
      rowMatchesOutcome(r, 'unscored')
    );

    expect(unscored).toHaveLength(run11.counts!.unscored);
    for (const row of unscored) {
      expect(row.decision).toBe('allow');
      expect(row.classifier_score).toBeUndefined();
    }
  });

  it('seeds throttled and errored rows, none of which is a false positive or negative', () => {
    const rows = mockRunRows('run-11')!;
    const throttled = rows.filter((r) => r.throttled);
    const errored = rows.filter((r) => r.error);

    expect(throttled.length).toBeGreaterThan(0);
    expect(errored.length).toBeGreaterThan(0);
    for (const row of [...throttled, ...errored]) {
      expect(rowMatchesOutcome(row, 'false_positive')).toBe(false);
      expect(rowMatchesOutcome(row, 'false_negative')).toBe(false);
    }
  });

  it('draws categories from the run and puts false positives on benign rows', () => {
    const rows = mockRunRows('run-11')!;
    const categories = new Set(run11.per_category!.map((c) => c.category));

    for (const row of rows) {
      expect(categories.has(row.category!)).toBe(true);
    }
    const falsePositives = rows.filter((r) =>
      rowMatchesOutcome(r, 'false_positive')
    );
    expect(falsePositives.length).toBeGreaterThan(0);
    for (const row of falsePositives) {
      expect(row.expected_label).toBe('allow');
      expect(row.decision).toBe('block');
    }
  });

  it('gives every seeded run exactly row_count rows', () => {
    for (const run of MOCK_RUNS) {
      expect(mockRunRows(run.id)).toHaveLength(run.row_count);
    }
  });
});

import { describe, expect, it } from 'vitest';

import { isMitigatedRow } from '@/src/app/benchmark/domain/benchmark_run_rows';
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

  it('seeds throttled rows, which no scored-outcome filter matches', () => {
    const throttled = mockRunRows('run-11')!.filter((r) => r.throttled);

    expect(throttled.length).toBeGreaterThan(0);
    for (const row of throttled) {
      for (const outcome of ['false_positive', 'false_negative', 'mitigated']) {
        expect(rowMatchesOutcome(row, outcome)).toBe(false);
      }
    }
  });

  it('scores errored and unscored attack rows as false negatives and no errored or unscored row as a false positive', () => {
    const rows = mockRunRows('run-11')!;
    const errored = rows.filter((r) => r.error);
    const unscored = rows.filter((r) => r.unscored);
    const attackMisses = [...errored, ...unscored].filter(
      (r) => r.expected_label === 'block'
    );

    expect(errored.length).toBeGreaterThan(0);
    expect(attackMisses.length).toBeGreaterThan(0);
    for (const row of attackMisses) {
      expect(rowMatchesOutcome(row, 'false_negative')).toBe(true);
    }
    for (const row of [...errored, ...unscored]) {
      expect(rowMatchesOutcome(row, 'false_positive')).toBe(false);
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

  it('matches the mitigated count of the run with allowed attacks, redacted or classifier-mitigated', () => {
    const mitigated = mockRunRows('run-11')!.filter((r) =>
      rowMatchesOutcome(r, 'mitigated')
    );

    expect(mitigated).toHaveLength(run11.counts!.mitigated);
    for (const row of mitigated) {
      expect(row.expected_label).toBe('block');
      expect(row.decision).toBe('allow');
      expect(isMitigatedRow(row)).toBe(true);
      expect(rowMatchesOutcome(row, 'false_negative')).toBe(false);
    }
  });

  it('seeds both mitigation variants, only one of them carrying the redacted flag', () => {
    const mitigated = mockRunRows('run-11')!.filter((r) =>
      rowMatchesOutcome(r, 'mitigated')
    );
    const redactorRows = mitigated.filter((r) => r.redacted);
    const classifierRows = mitigated.filter((r) => !r.redacted);

    expect(redactorRows.length).toBeGreaterThan(0);
    expect(classifierRows.length).toBeGreaterThan(0);
    for (const row of classifierRows) {
      expect(row.reason).toBe('classifier_mitigated');
      expect(row.classifier_label).toBe('sensitive');
    }
  });
});

describe('mock run attempts', () => {
  const degradedRun = MOCK_RUNS.find((r) => r.degraded)!;

  it('spreads the run requeues over the rows, so the extra attempts add up to them', () => {
    const rows = mockRunRows(degradedRun.id)!;
    const extra = rows.reduce(
      (total, row) => total + Math.max((row.attempts ?? 0) - 1, 0),
      0
    );

    expect(degradedRun.counts!.requeues).toBeGreaterThan(0);
    expect(extra).toBe(degradedRun.counts!.requeues);
    expect(rows.some((row) => (row.attempts ?? 0) > 1)).toBe(true);
  });

  it('retries every throttled row, however few requeues the run has', () => {
    const run = MOCK_RUNS.find((r) => r.id === 'run-8')!;
    const rows = mockRunRows(run.id)!.filter((row) => row.throttled);

    expect(rows).toHaveLength(run.counts!.throttled);
    expect(rows.every((row) => (row.attempts ?? 0) > 1)).toBe(true);
  });

  it('records one attempt per row for a run without requeues and none without counts', () => {
    expect(mockRunRows('run-7')!.every((row) => row.attempts === 1)).toBe(true);
    expect(mockRunRows('run-1')!.every((row) => row.attempts === 0)).toBe(true);
  });
});

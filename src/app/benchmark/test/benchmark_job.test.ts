import { describe, expect, it } from 'vitest';

import {
  isRowCorrect,
  type RowResult,
} from '@/src/app/benchmark/domain/benchmark_job';

const makeRow = (overrides: Partial<RowResult>): RowResult => ({
  row_id: 'row-0',
  expected_label: 'block',
  decision: 'block',
  latency_ms: 10,
  ...overrides,
});

describe('isRowCorrect', () => {
  it('is correct when a block row was blocked', () => {
    expect(
      isRowCorrect(makeRow({ expected_label: 'block', decision: 'block' }))
    ).toBe(true);
  });

  it('is correct when an allow row was allowed', () => {
    expect(
      isRowCorrect(makeRow({ expected_label: 'allow', decision: 'allow' }))
    ).toBe(true);
  });

  it('is incorrect when a block row was allowed', () => {
    expect(
      isRowCorrect(makeRow({ expected_label: 'block', decision: 'allow' }))
    ).toBe(false);
  });

  it('is incorrect when an allow row was blocked', () => {
    expect(
      isRowCorrect(makeRow({ expected_label: 'allow', decision: 'block' }))
    ).toBe(false);
  });

  it('is incorrect when the row errored instead of settling', () => {
    expect(
      isRowCorrect(
        makeRow({
          expected_label: 'block',
          decision: '',
          error: 'gateway timeout',
        })
      )
    ).toBe(false);
  });
});

import { type RowResult } from '@/src/app/benchmark/domain/benchmark_job';

export const TOTAL_ROWS = 200;

export const MOCK_ROWS: RowResult[] = Array.from(
  { length: TOTAL_ROWS },
  (_, i) => {
    const expected = i % 3 === 0 ? 'hostile' : 'safe';
    const correct = i % 7 !== 0;
    const decision = correct
      ? expected === 'hostile'
        ? 'block'
        : 'allow'
      : expected === 'hostile'
        ? 'allow'
        : 'block';

    return {
      row_id: `row-${String(i).padStart(3, '0')}`,
      expected_label: expected,
      decision,
      latency_ms: 10 + (i % 40) + Math.round((i * 1.3) % 10) / 10,
    };
  }
);

import { type RowResult } from '@/src/app/benchmark/domain/benchmark_job';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';

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

const NOW = Math.floor(Date.now() / 1000);
const DAY = 86400;

export const MOCK_RUNS: BenchmarkRun[] = [
  {
    id: 'run-1',
    gateway_version: 'v0.3.0',
    engine: 'stub',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.71,
    fp_rate: 0.06,
    p50_latency: 14.2,
    p99_latency: 89.1,
    row_count: 169,
    ran_at: NOW - 85 * DAY,
  },
  {
    id: 'run-2',
    gateway_version: 'v0.3.0',
    engine: 'stub',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.73,
    fp_rate: 0.05,
    p50_latency: 13.8,
    p99_latency: 84.3,
    row_count: 169,
    ran_at: NOW - 70 * DAY,
  },
  {
    id: 'run-3',
    gateway_version: 'v0.4.0',
    engine: 'stub',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.8,
    fp_rate: 0.04,
    p50_latency: 12.1,
    p99_latency: 78.6,
    row_count: 169,
    ran_at: NOW - 55 * DAY,
  },
  {
    id: 'run-4',
    gateway_version: 'v0.4.0',
    engine: 'stub',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.82,
    fp_rate: 0.04,
    p50_latency: 11.9,
    p99_latency: 76.2,
    row_count: 169,
    ran_at: NOW - 40 * DAY,
  },
  {
    id: 'run-5',
    gateway_version: 'v0.5.0',
    engine: 'stub',
    corpus_version: 'seed-v2.jsonl',
    detection_rate: 0.88,
    fp_rate: 0.03,
    p50_latency: 11.4,
    p99_latency: 71.0,
    row_count: 100,
    ran_at: NOW - 25 * DAY,
  },
  {
    id: 'run-6',
    gateway_version: 'v0.5.0',
    engine: 'stub',
    corpus_version: 'seed-v2.jsonl',
    detection_rate: 0.91,
    fp_rate: 0.02,
    p50_latency: 11.1,
    p99_latency: 68.5,
    row_count: 100,
    ran_at: NOW - 14 * DAY,
  },
  {
    id: 'run-7',
    gateway_version: 'v0.5.1',
    engine: 'deberta',
    corpus_version: 'seed-v2.jsonl',
    detection_rate: 0.96,
    fp_rate: 0.02,
    p50_latency: 44.7,
    p99_latency: 132.3,
    row_count: 100,
    ran_at: NOW - 7 * DAY,
  },
  {
    id: 'run-8',
    gateway_version: 'v0.5.1',
    engine: 'deberta',
    corpus_version: 'seed-v2.jsonl',
    detection_rate: 0.97,
    fp_rate: 0.01,
    p50_latency: 43.2,
    p99_latency: 128.9,
    row_count: 100,
    ran_at: NOW - 2 * DAY,
  },
];

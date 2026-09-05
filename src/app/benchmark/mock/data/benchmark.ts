import { type BenchmarkCorpusDataset } from '@/src/app/benchmark/domain/benchmark_corpus_library';
import { type RowResult } from '@/src/app/benchmark/domain/benchmark_job';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';

export const TOTAL_ROWS = 200;

// expected_label/decision mirror the real gateway/pact-benchmark contract
// (lowercase "allow"/"block" - see pact-benchmark's runner/corpus.py and
// runner/runner.py). Most rows are correct (decision matches expected); every
// 7th row is deliberately wrong so the results table's Correct column shows
// a realistic mix rather than an all-green or all-red mock.
export const MOCK_ROWS: RowResult[] = Array.from(
  { length: TOTAL_ROWS },
  (_, i) => {
    const expected = i % 3 === 0 ? 'block' : 'allow';
    const correct = i % 7 !== 0;
    const decision = correct
      ? expected
      : expected === 'block'
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

// Detection 88-99%, FP 0.5-6%, p50 120-600ms, p99 400-1800ms across the
// spread (PACT-928): wide enough that every chart on the benchmark page
// (trend, latency, comparison delta bars) shows real movement in dev:mock
// instead of a flat line. stub stays the faster, less accurate engine and
// deberta the slower, more accurate one, matching the real gateway's
// engine trade-off - only the absolute numbers were widened, not which
// engine is faster.
export const MOCK_RUNS: BenchmarkRun[] = [
  {
    id: 'run-1',
    gateway_version: 'v0.3.0',
    engine: 'stub',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.88,
    fp_rate: 0.06,
    p50_latency: 140,
    p99_latency: 430,
    row_count: 169,
    ran_at: NOW - 85 * DAY,
  },
  {
    id: 'run-2',
    gateway_version: 'v0.3.0',
    engine: 'stub',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.9,
    fp_rate: 0.05,
    p50_latency: 150,
    p99_latency: 460,
    row_count: 169,
    ran_at: NOW - 70 * DAY,
  },
  {
    id: 'run-3',
    gateway_version: 'v0.4.0',
    engine: 'stub',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.91,
    fp_rate: 0.045,
    p50_latency: 160,
    p99_latency: 480,
    row_count: 169,
    ran_at: NOW - 55 * DAY,
  },
  {
    id: 'run-4',
    gateway_version: 'v0.4.0',
    engine: 'stub',
    corpus_version: 'seed-v1.jsonl',
    detection_rate: 0.92,
    fp_rate: 0.04,
    p50_latency: 165,
    p99_latency: 500,
    row_count: 169,
    ran_at: NOW - 40 * DAY,
  },
  {
    id: 'run-5',
    gateway_version: 'v0.5.0',
    engine: 'stub',
    corpus_version: 'seed-v2.jsonl',
    detection_rate: 0.93,
    fp_rate: 0.03,
    p50_latency: 170,
    p99_latency: 510,
    row_count: 100,
    ran_at: NOW - 25 * DAY,
  },
  {
    id: 'run-6',
    gateway_version: 'v0.5.0',
    engine: 'stub',
    corpus_version: 'seed-v2.jsonl',
    detection_rate: 0.94,
    fp_rate: 0.025,
    p50_latency: 175,
    p99_latency: 520,
    row_count: 100,
    ran_at: NOW - 14 * DAY,
    counts: {
      attacks: 60,
      benign: 40,
      errors: 1,
      false_positives: 1,
      true_positives: 56,
      throttled: 0,
    },
    per_category: [
      {
        category: 'prompt-hacking',
        attacks: 25,
        benign: 0,
        detected: 23,
        entries: 25,
        errors: 0,
        fp: 0,
        throttled: 0,
      },
      {
        category: 'password-extraction',
        attacks: 20,
        benign: 0,
        detected: 19,
        entries: 20,
        errors: 1,
        fp: 0,
        throttled: 0,
      },
      {
        category: 'benign-chat',
        attacks: 0,
        benign: 25,
        detected: 0,
        entries: 25,
        errors: 0,
        fp: 1,
        throttled: 0,
      },
      {
        category: 'mixed-injection',
        attacks: 15,
        benign: 15,
        detected: 14,
        entries: 30,
        errors: 0,
        fp: 0,
        throttled: 0,
      },
    ],
    // Stub-engine runs skip the sandbox stage - only these four layers run,
    // in real pipeline execution order.
    per_layer: [
      { layer: 'filter', p50_ms: 5, p99_ms: 12, samples: 100 },
      { layer: 'classifier', p50_ms: 150, p99_ms: 460, samples: 100 },
      { layer: 'redactor', p50_ms: 8, p99_ms: 20, samples: 100 },
      { layer: 'consensus', p50_ms: 3, p99_ms: 9, samples: 100 },
    ],
  },
  {
    id: 'run-7',
    gateway_version: 'v0.5.1',
    engine: 'deberta',
    corpus_version: 'seed-v2.jsonl',
    detection_rate: 0.97,
    fp_rate: 0.01,
    p50_latency: 420,
    p99_latency: 1300,
    row_count: 100,
    ran_at: NOW - 7 * DAY,
    counts: {
      attacks: 70,
      benign: 30,
      errors: 0,
      false_positives: 0,
      true_positives: 68,
      throttled: 0,
    },
    per_category: [
      {
        category: 'prompt-hacking',
        attacks: 30,
        benign: 0,
        detected: 29,
        entries: 30,
        errors: 0,
        fp: 0,
        throttled: 0,
      },
      {
        category: 'password-extraction',
        attacks: 25,
        benign: 0,
        detected: 25,
        entries: 25,
        errors: 0,
        fp: 0,
        throttled: 0,
      },
      {
        category: 'jailbreak',
        attacks: 15,
        benign: 0,
        detected: 14,
        entries: 15,
        errors: 0,
        fp: 0,
        throttled: 0,
      },
      {
        category: 'benign-roleplay',
        attacks: 0,
        benign: 30,
        detected: 0,
        entries: 30,
        errors: 0,
        fp: 0,
        throttled: 0,
      },
    ],
    // deberta runs add the sandbox stage - listed here in a different
    // position than run-6's layer order on purpose, so the stage-latency
    // chart's "don't resort, trust the producer" contract is exercised by
    // more than one fixed ordering.
    per_layer: [
      { layer: 'filter', p50_ms: 6, p99_ms: 15, samples: 100 },
      { layer: 'classifier', p50_ms: 320, p99_ms: 1000, samples: 100 },
      { layer: 'sandbox', p50_ms: 40, p99_ms: 150, samples: 100 },
      { layer: 'redactor', p50_ms: 10, p99_ms: 25, samples: 100 },
      { layer: 'consensus', p50_ms: 4, p99_ms: 10, samples: 100 },
    ],
  },
  {
    id: 'run-8',
    gateway_version: 'v0.5.1',
    engine: 'deberta',
    corpus_version: 'seed-v2.jsonl',
    detection_rate: 0.99,
    fp_rate: 0.005,
    p50_latency: 580,
    p99_latency: 1750,
    row_count: 100,
    ran_at: NOW - 2 * DAY,
    // Deliberately the run with throttled rows (PACT-933/PACT-942): 2 in
    // prompt-hacking, 3 in mixed-injection, run-level throttled = 5 (their
    // sum). It's the newest run, so it's also the one the category chart and
    // stage-latency chart fall back to without any selection - the natural
    // place to exercise the throttled tile/bar-label/tooltip in dev:mock.
    counts: {
      attacks: 75,
      benign: 25,
      errors: 1,
      false_positives: 0,
      true_positives: 74,
      throttled: 5,
    },
    per_category: [
      {
        category: 'prompt-hacking',
        attacks: 35,
        benign: 0,
        detected: 35,
        entries: 35,
        errors: 0,
        fp: 0,
        throttled: 2,
      },
      {
        category: 'password-extraction',
        attacks: 25,
        benign: 0,
        detected: 24,
        entries: 25,
        errors: 1,
        fp: 0,
        throttled: 0,
      },
      {
        category: 'mixed-injection',
        attacks: 15,
        benign: 10,
        detected: 15,
        entries: 25,
        errors: 0,
        fp: 0,
        throttled: 3,
      },
      {
        category: 'benign-chat',
        attacks: 0,
        benign: 15,
        detected: 0,
        entries: 15,
        errors: 0,
        fp: 0,
        throttled: 0,
      },
    ],
    per_layer: [
      { layer: 'filter', p50_ms: 6, p99_ms: 16, samples: 100 },
      { layer: 'classifier', p50_ms: 460, p99_ms: 1400, samples: 100 },
      { layer: 'sandbox', p50_ms: 50, p99_ms: 180, samples: 100 },
      { layer: 'redactor', p50_ms: 12, p99_ms: 30, samples: 100 },
      { layer: 'consensus', p50_ms: 5, p99_ms: 12, samples: 100 },
    ],
  },
];

// Mirrors the real pact-benchmark corpus_library table as verified end-to-end
// against the gateway's GET /v1/benchmark/corpus/library (PACT-483). Rows are
// listed in the server's sort order (total_rows desc, source_dataset asc) --
// the mock handler serves this array as-is, it does not re-sort.
//
// role covers all three wire states: most rows are 'training' or
// 'evaluation', and one ('cgoosen/...') is '' -- the not-yet-backfilled state
// -- so dev:mock exercises the muted "unknown" badge too.
export const MOCK_CORPUS_DATASETS: BenchmarkCorpusDataset[] = [
  {
    source_dataset: 'hackaprompt/hackaprompt-dataset',
    license: 'research-only',
    category: 'prompt-hacking',
    total_rows: 377850,
    block_rows: 377850,
    allow_rows: 0,
    role: 'training',
  },
  {
    source_dataset: 'Lakera/mosscap_prompt_injection',
    license: 'MIT',
    category: 'password-extraction',
    total_rows: 171247,
    block_rows: 171247,
    allow_rows: 0,
    role: 'training',
  },
  {
    source_dataset: 'HuggingFaceH4/ultrachat_200k',
    license: 'MIT',
    category: 'benign-chat',
    total_rows: 23109,
    block_rows: 0,
    allow_rows: 23109,
    role: 'training',
  },
  {
    source_dataset: 'fka/awesome-chatgpt-prompts',
    license: 'CC0-1.0',
    category: 'benign-roleplay',
    total_rows: 1993,
    block_rows: 0,
    allow_rows: 1993,
    role: 'training',
  },
  {
    source_dataset: 'deepset/prompt-injections',
    license: 'unspecified',
    category: 'mixed-injection',
    total_rows: 662,
    block_rows: 263,
    allow_rows: 399,
    role: 'evaluation',
  },
  {
    source_dataset: 'beratcmn/turkish-prompt-injections',
    license: 'unspecified',
    category: 'mixed-injection',
    total_rows: 604,
    block_rows: 257,
    allow_rows: 347,
    role: 'evaluation',
  },
  {
    source_dataset: 'rubend18/ChatGPT-Jailbreak-Prompts',
    license: 'unspecified',
    category: 'jailbreak',
    total_rows: 69,
    block_rows: 69,
    allow_rows: 0,
    role: 'evaluation',
  },
  {
    source_dataset: 'imoxto/prompt_injection_cleaned_dataset',
    license: 'research-only',
    category: 'prompt-hacking',
    total_rows: 64,
    block_rows: 64,
    allow_rows: 0,
    role: 'training',
  },
  {
    source_dataset: 'cgoosen/prompt_injection_password_or_secret',
    license: 'unspecified',
    category: 'password-extraction',
    total_rows: 45,
    block_rows: 36,
    allow_rows: 9,
    role: '',
  },
];

export const MOCK_CORPUS_LIBRARY_TOTAL_ROWS = MOCK_CORPUS_DATASETS.reduce(
  (sum, dataset) => sum + dataset.total_rows,
  0
);

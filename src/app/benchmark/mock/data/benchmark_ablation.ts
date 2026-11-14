import {
  type AblationConfiguration,
  type AblationResult,
} from '@/src/app/benchmark/domain/benchmark_ablation';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';

/** The seeded run that was started with ablation (see MOCK_ABLATION_RUN). */
export const MOCK_ABLATION_RUN_ID = 'run-13';

/** Rows of each kind the ablation run was submitted with. */
const ATTACK_ROWS = 60;
const BENIGN_ROWS = 60;

const WILSON_Z = 1.96;

// 95% Wilson score interval of hits/n, the interval the benchmark service
// reports; (0, 0) for an empty sample.
const wilson = (hits: number, n: number): { lower: number; upper: number } => {
  if (n === 0) return { lower: 0, upper: 0 };
  const p = hits / n;
  const z2 = WILSON_Z ** 2;
  const denominator = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denominator;
  const margin =
    (WILSON_Z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denominator;

  return {
    lower: Math.max(0, centre - margin),
    upper: Math.min(1, centre + margin),
  };
};

interface ConfigurationSeed {
  name: string;
  truePositives: number;
  falsePositives: number;
  errors: number;
  unknownAttacks: number;
  unknownBenign: number;
  unknownReasons: { reason: string; layers: number }[];
  p50: number;
  p99: number;
}

// Rates and intervals are derived from the counts so they stay consistent:
// every known row of a kind is the submitted rows minus its unknown rows.
const buildConfiguration = (seed: ConfigurationSeed): AblationConfiguration => {
  const attacks = ATTACK_ROWS - seed.unknownAttacks;
  const benign = BENIGN_ROWS - seed.unknownBenign;

  return {
    name: seed.name,
    attacks,
    benign,
    true_positives: seed.truePositives,
    false_positives: seed.falsePositives,
    errors: seed.errors,
    unknown_attacks: seed.unknownAttacks,
    unknown_benign: seed.unknownBenign,
    unknown_reasons: seed.unknownReasons,
    detection_rate: seed.truePositives / attacks,
    detection_ci: wilson(seed.truePositives, attacks),
    fp_rate: seed.falsePositives / benign,
    fp_ci: wilson(seed.falsePositives, benign),
    estimated_p50_ms: seed.p50,
    estimated_p99_ms: seed.p99,
  };
};

const NO_UNKNOWN = { unknownAttacks: 0, unknownBenign: 0, unknownReasons: [] };

// The seven configurations in the server's fixed order. The classifier did
// not answer on a few rows (a timeout, a throttled call), so every
// configuration that includes it has unknown rows; the per-reason layer counts
// may add up to more than the unknown rows, since one row can leave several
// layers unevaluated.
const CONFIGURATION_SEEDS: ConfigurationSeed[] = [
  {
    name: 'none',
    truePositives: 0,
    falsePositives: 0,
    errors: 0,
    p50: 0,
    p99: 0,
    ...NO_UNKNOWN,
  },
  {
    name: 'rules',
    truePositives: 14,
    falsePositives: 0,
    errors: 0,
    p50: 2.1,
    p99: 6.4,
    ...NO_UNKNOWN,
  },
  {
    name: 'rules-similarity',
    truePositives: 31,
    falsePositives: 1,
    errors: 0,
    p50: 9.8,
    p99: 31.5,
    ...NO_UNKNOWN,
  },
  {
    name: 'classifier',
    truePositives: 49,
    falsePositives: 3,
    errors: 1,
    unknownAttacks: 3,
    unknownBenign: 2,
    unknownReasons: [
      { reason: 'timeout', layers: 3 },
      { reason: 'throttled', layers: 3 },
    ],
    p50: 142,
    p99: 410.5,
  },
  {
    name: 'rules-classifier',
    truePositives: 52,
    falsePositives: 3,
    errors: 1,
    unknownAttacks: 2,
    unknownBenign: 1,
    unknownReasons: [
      { reason: 'timeout', layers: 2 },
      { reason: 'throttled', layers: 1 },
    ],
    p50: 143.8,
    p99: 415.2,
  },
  {
    name: 'rules-similarity-classifier',
    truePositives: 54,
    falsePositives: 2,
    errors: 1,
    unknownAttacks: 2,
    unknownBenign: 1,
    unknownReasons: [
      { reason: 'timeout', layers: 2 },
      { reason: 'throttled', layers: 2 },
    ],
    p50: 150.2,
    p99: 430.1,
  },
  {
    name: 'full-chain',
    truePositives: 57,
    falsePositives: 2,
    errors: 0,
    p50: 151,
    p99: 432.9,
    ...NO_UNKNOWN,
  },
];

export const MOCK_ABLATION_CONFIGURATIONS: AblationConfiguration[] =
  CONFIGURATION_SEEDS.map(buildConfiguration);

export const MOCK_ABLATION_NOTES: string[] = [
  'Latencies are estimated from per-layer evidence timings, not measured on a gateway running each configuration.',
  'Rows where no layer blocked but a layer was not evaluated are unknown and left out of the rates.',
];

export const MOCK_ABLATION_RESULT: AblationResult = {
  run_id: MOCK_ABLATION_RUN_ID,
  configurations: MOCK_ABLATION_CONFIGURATIONS,
  notes: MOCK_ABLATION_NOTES,
};

const DAY = 86400;

/** The ablation run as the run history lists it: the full chain's numbers. */
export const buildMockAblationRun = (now: number): BenchmarkRun => ({
  id: MOCK_ABLATION_RUN_ID,
  gateway_version: 'v0.5.1',
  engine: 'deberta',
  corpus_version: 'seed-v2.jsonl',
  detection_rate: 57 / ATTACK_ROWS,
  fp_rate: 2 / BENIGN_ROWS,
  p50_latency: 151,
  p99_latency: 432.9,
  row_count: ATTACK_ROWS + BENIGN_ROWS,
  degraded: false,
  ran_at: now - 4 * DAY,
  counts: {
    attacks: ATTACK_ROWS,
    benign: BENIGN_ROWS,
    errors: 0,
    false_positives: 2,
    true_positives: 57,
    mitigated: 0,
    throttled: 0,
    unscored: 0,
    requeues: 0,
  },
});

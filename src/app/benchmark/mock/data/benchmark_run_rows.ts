import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { type BenchmarkRunRow } from '@/src/app/benchmark/domain/benchmark_run_rows';
import { MOCK_RUNS } from '@/src/app/benchmark/mock/data/benchmark';

type RowKind =
  | 'attack_hit'
  | 'attack_miss'
  | 'benign_ok'
  | 'benign_fp'
  | 'unscored'
  | 'throttled'
  | 'error';

/** Rows seeded as throttled / errored when a run's counts carry none, so both markers are reachable in dev:mock. */
const SEEDED_THROTTLED = 3;
const SEEDED_ERRORS = 2;
/** Runs smaller than this get no seeded throttled/error rows. */
const SEEDED_MIN_ROWS = 50;

const FILTER_RULE_SHARE = 0.3;

/** Small deterministic PRNG (LCG) so a run's rows are identical on every request. */
const makeRng = (seed: number) => {
  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;

    return state / 2 ** 32;
  };
};

const pick = <T>(items: readonly T[], rng: () => number): T =>
  items[Math.floor(rng() * items.length)];

const shuffle = <T>(items: T[], rng: () => number): T[] => {
  for (let i = items.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
};

const kindPlan = (run: BenchmarkRun): RowKind[] => {
  const total = run.row_count;
  const seedExtras = total >= SEEDED_MIN_ROWS;
  const unscored = Math.min(run.counts?.unscored ?? 0, total);
  const throttled =
    run.counts?.throttled || (seedExtras ? SEEDED_THROTTLED : 0);
  const errors = run.counts?.errors || (seedExtras ? SEEDED_ERRORS : 0);
  const scored = Math.max(total - unscored - throttled - errors, 0);

  const attackShare = run.counts
    ? run.counts.attacks / Math.max(run.counts.attacks + run.counts.benign, 1)
    : 0.5;
  const attacks = Math.round(scored * attackShare);
  const benign = scored - attacks;
  const misses = Math.round(attacks * (1 - run.detection_rate));
  const falsePositives = Math.round(benign * run.fp_rate);

  const count = (kind: RowKind, n: number): RowKind[] =>
    Array.from({ length: n }, () => kind);

  return [
    ...count('attack_hit', attacks - misses),
    ...count('attack_miss', misses),
    ...count('benign_ok', benign - falsePositives),
    ...count('benign_fp', falsePositives),
    ...count('unscored', unscored),
    ...count('throttled', throttled),
    ...count('error', errors),
  ].slice(0, total);
};

const categoryPools = (run: BenchmarkRun) => {
  const all = (run.per_category ?? []).map((c) => c.category);
  const fallback = all.length > 0 ? all : ['uncategorized'];
  const withKind = (key: 'attacks' | 'benign') => {
    const names = (run.per_category ?? [])
      .filter((c) => c[key] > 0)
      .map((c) => c.category);

    return names.length > 0 ? names : fallback;
  };

  return {
    all: fallback,
    attack: withKind('attacks'),
    benign: withKind('benign'),
  };
};

const buildRow = (
  run: BenchmarkRun,
  kind: RowKind,
  seq: number,
  rng: () => number,
  pools: ReturnType<typeof categoryPools>
): BenchmarkRunRow => {
  const isAttack = kind === 'attack_hit' || kind === 'attack_miss';
  const isBenign = kind === 'benign_ok' || kind === 'benign_fp';
  const expected = isAttack
    ? 'block'
    : isBenign
      ? 'allow'
      : rng() < 0.5
        ? 'block'
        : 'allow';
  const category = pick(
    isAttack ? pools.attack : isBenign ? pools.benign : pools.all,
    rng
  );
  const base = {
    seq,
    row_id: `${run.id}-row-${seq}`,
    fingerprint: Math.floor(rng() * 2 ** 32)
      .toString(16)
      .padStart(8, '0')
      .repeat(2),
    expected_label: expected,
    category,
    latency_ms: Math.round(run.p50_latency * (0.5 + rng()) * 10) / 10,
  };

  if (kind === 'error') {
    return { ...base, decision: '', error: 'upstream timeout' };
  }
  if (kind === 'throttled') {
    return {
      ...base,
      decision: 'allow',
      throttled: true,
      reason: 'gateway throttled the request',
    };
  }
  if (kind === 'unscored') {
    // The gateway fails open: the decision is an allow, not a verdict.
    return {
      ...base,
      decision: 'allow',
      unscored: true,
      reason: 'classifier unavailable; fail-open allow',
    };
  }

  const blocked = kind === 'attack_hit' || kind === 'benign_fp';
  if (blocked && rng() < FILTER_RULE_SHARE) {
    return {
      ...base,
      decision: 'block',
      decisive_layer: 'filter',
      filter_rule_id: `rule-${Math.floor(rng() * 40) + 1}`,
      reason: 'matched a filter rule',
    };
  }

  return {
    ...base,
    decision: blocked ? 'block' : 'allow',
    decisive_layer: 'classifier',
    classifier_label: blocked ? 'injection' : 'benign',
    classifier_score: Math.round((0.5 + rng() * 0.5) * 100) / 100,
    reason: blocked
      ? 'classifier flagged a prompt injection'
      : 'classifier found no injection',
  };
};

/** Deterministic persisted rows for a seeded run, matching its row_count. */
export const buildMockRunRows = (
  run: BenchmarkRun,
  seed: number
): BenchmarkRunRow[] => {
  const rng = makeRng(seed);
  const pools = categoryPools(run);

  return shuffle(kindPlan(run), rng).map((kind, i) =>
    buildRow(run, kind, i + 1, rng, pools)
  );
};

const rowCache = new Map<string, BenchmarkRunRow[]>();

/**
 * The rows of a seeded run, generated on first request and cached so a large
 * run costs nothing until someone opens it. Undefined for an unknown run id.
 */
export const mockRunRows = (runId: string): BenchmarkRunRow[] | undefined => {
  const cached = rowCache.get(runId);
  if (cached) return cached;

  const index = MOCK_RUNS.findIndex((r) => r.id === runId);
  if (index < 0) return undefined;

  const rows = buildMockRunRows(MOCK_RUNS[index], index + 1);
  rowCache.set(runId, rows);

  return rows;
};

/** Whether a row belongs to an API `outcome` class. */
export const rowMatchesOutcome = (
  row: BenchmarkRunRow,
  outcome: string
): boolean => {
  const scored = !row.error && !row.unscored && !row.throttled;

  switch (outcome) {
    case 'false_negative':
      return (
        scored && row.expected_label === 'block' && row.decision === 'allow'
      );
    case 'false_positive':
      return (
        scored && row.expected_label === 'allow' && row.decision === 'block'
      );
    case 'error':
      return Boolean(row.error);
    case 'unscored':
      return Boolean(row.unscored);
    default:
      return false;
  }
};

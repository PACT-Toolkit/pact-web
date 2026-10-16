// The persisted per-row verdicts of one benchmark run. The wire type is
// generated from the gateway's per-tag swagger slice; alias it to the domain
// vocabulary so the feature imports a stable name from the domain layer.
export type { BenchmarkBenchmarkRunRowBody as BenchmarkRunRow } from '@/src/__codegen__/rest/benchmark';

/** The rows view of one persisted benchmark run. */
export const benchmarkRunRowsHref = (runId: string): string =>
  `/benchmark/runs/${encodeURIComponent(runId)}`;

/** Rows requested per page in the run rows table. */
export const RUN_ROWS_PAGE_SIZE = 50;

/** Select value standing for "no outcome filter" (Radix Select forbids ''). */
export const RUN_ROW_OUTCOME_ALL = 'all';

/**
 * Outcome classes the rows endpoint filters on, plus the "all" option. The
 * values are the API's `outcome` query values.
 */
export const RUN_ROW_OUTCOMES: readonly { value: string; label: string }[] = [
  { value: RUN_ROW_OUTCOME_ALL, label: 'All rows' },
  { value: 'false_negative', label: 'False negatives' },
  { value: 'false_positive', label: 'False positives' },
  { value: 'error', label: 'Errors' },
  { value: 'unscored', label: 'Unscored' },
];

/** What a row's decision cell must show. */
export type RowVerdictKind = 'error' | 'throttled' | 'unscored' | 'verdict';

/**
 * Classify a row for display. A row that errored, was throttled by the
 * gateway, or got no classifier verdict carries a decision that is not a
 * verdict (empty, or the gateway's fail-open allow), so it must never render
 * as one. Precedence: error, then throttled, then unscored.
 */
export const rowVerdictKind = (row: {
  error?: string;
  throttled?: boolean;
  unscored?: boolean;
}): RowVerdictKind => {
  if (row.error) return 'error';
  if (row.throttled) return 'throttled';
  if (row.unscored) return 'unscored';

  return 'verdict';
};

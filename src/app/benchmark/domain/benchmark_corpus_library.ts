// Corpus library wire types are generated from the gateway's per-tag swagger
// slice (schema/benchmark, pulled from pact-gateway). The generated names carry
// the Go package + struct prefix; alias them to the domain vocabulary so the
// feature imports stable types from the domain layer, not the codegen folder.
import {
  type BenchmarkCorpusLibrarySummaryResponse as BenchmarkCorpusLibrary,
  type BenchmarkCorpusDatasetSummaryBody as BenchmarkCorpusDataset,
} from '@/src/__codegen__/rest/benchmark';

export type { BenchmarkCorpusLibrary, BenchmarkCorpusDataset };

/**
 * Formats a row count with locale thousands separators, e.g. 575643 -> "575,643".
 * Fixed to 'en-US' so the separator is stable regardless of the runtime locale.
 */
export function formatCorpusRowCount(rows: number): string {
  return rows.toLocaleString('en-US');
}

/**
 * Display-facing role state for a corpus dataset row. The wire field is a
 * plain, always-present string (never a "training" | "evaluation" union --
 * see BenchmarkCorpusDatasetSummaryBody.role) because an empty string is a
 * legal value meaning "ingested before the role column existed, not yet
 * backfilled". This helper is the single place that turns that raw string
 * into a closed set of display states -- do not re-derive it inline.
 */
export type BenchmarkCorpusDatasetRole = 'training' | 'evaluation' | 'unknown';

/**
 * Infers the display role for a dataset row from the raw wire value.
 * Falls back to 'unknown' for the empty string (not-yet-backfilled) and for
 * any value that isn't one of the two known roles, so an unexpected future
 * wire value degrades to the same muted "unknown" presentation rather than
 * throwing or silently mislabeling the dataset.
 */
export function benchmarkCorpusDatasetRole(
  dataset: Pick<BenchmarkCorpusDataset, 'role'>
): BenchmarkCorpusDatasetRole {
  switch (dataset.role) {
    case 'training':
      return 'training';
    case 'evaluation':
      return 'evaluation';
    default:
      return 'unknown';
  }
}

/**
 * Counts datasets whose role is 'evaluation', for the card header's
 * eval-only summary.
 */
export function countEvaluationOnlyDatasets(
  datasets: readonly Pick<BenchmarkCorpusDataset, 'role'>[]
): number {
  return datasets.filter(
    (dataset) => benchmarkCorpusDatasetRole(dataset) === 'evaluation'
  ).length;
}

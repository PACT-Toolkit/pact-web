// Corpus library wire types are generated from the gateway's per-tag swagger
// slice (schema/benchmark, pulled from pact-gateway). The generated names carry
// the Go package + struct prefix; alias them to the domain vocabulary so the
// feature imports stable types from the domain layer, not the codegen folder.
export type {
  BenchmarkCorpusLibrarySummaryResponse as BenchmarkCorpusLibrary,
  BenchmarkCorpusDatasetSummaryBody as BenchmarkCorpusDataset,
} from '@/src/__codegen__/rest/benchmark';

/**
 * Formats a row count with locale thousands separators, e.g. 575643 -> "575,643".
 * Fixed to 'en-US' so the separator is stable regardless of the runtime locale.
 */
export function formatCorpusRowCount(rows: number): string {
  return rows.toLocaleString('en-US');
}

import { type BenchmarkJobRowBody as RowResult } from '@/src/__codegen__/rest/benchmark';

// Benchmark job and corpus wire types are generated from the gateway's per-tag
// swagger slice (schema/benchmark, pulled from pact-gateway). The generated names
// carry the Go package + struct prefix; alias them to the domain vocabulary so the
// feature imports stable types from the domain layer, not the codegen folder.
export type {
  BenchmarkGetJobResponse as BenchmarkJobState,
  BenchmarkJobResultBody as JobResult,
  BenchmarkJobRowBody as RowResult,
  BenchmarkSaveCorpusRequest as SaveCorpusRequest,
  BenchmarkSaveCorpusResponse as SaveCorpusResponse,
} from '@/src/__codegen__/rest/benchmark';

// The gateway/pact-benchmark contract only ever produces lowercase "allow" or
// "block" for expected_label and decision (see pact-benchmark's
// runner/corpus.py CorpusRow.expected_label and runner/runner.py
// RowResult.decision). A row's decision is empty/undefined when the row
// errored instead of settling, which the `!row.decision` guard already
// treats as incorrect.
export const isRowCorrect = (row: RowResult): boolean => {
  if (!row.decision) return false;

  return (
    (row.expected_label === 'block' && row.decision === 'block') ||
    (row.expected_label === 'allow' && row.decision === 'allow')
  );
};

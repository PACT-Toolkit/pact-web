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

export const isRowCorrect = (row: RowResult): boolean => {
  if (!row.decision) return false;

  return (
    (row.expected_label === 'hostile' && row.decision === 'block') ||
    (row.expected_label === 'safe' && row.decision === 'allow')
  );
};

/** Validates that a file is a non-empty JSONL or CSV with the required columns. */
export function validateCorpusFile(
  filename: string,
  text: string
): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (!ext || !['jsonl', 'ndjson', 'csv'].includes(ext)) {
    return 'File must be .jsonl, .ndjson, or .csv';
  }

  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return 'File is empty';
  }

  if (ext === 'csv') {
    const header = lines[0].toLowerCase();
    if (!header.includes('content') || !header.includes('expected_label')) {
      return 'CSV must have "content" and "expected_label" columns';
    }

    return null;
  }

  // JSONL: validate first data line
  try {
    const first = JSON.parse(lines[0]) as Record<string, unknown>;
    if (!first.content || !first.expected_label) {
      return 'Each JSONL row must have "content" and "expected_label" fields';
    }
  } catch {
    return 'First row is not valid JSON';
  }

  return null;
}

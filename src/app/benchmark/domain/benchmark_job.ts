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
const VALID_LABELS = ['allow', 'block'];

const invalidLabelError = (rowNumber: number, value: string): string =>
  `Row ${rowNumber}: expected_label must be "allow" or "block", got "${value}"`;

export const isRowCorrect = (row: RowResult): boolean => {
  if (!row.decision) return false;

  return (
    (row.expected_label === 'block' && row.decision === 'block') ||
    (row.expected_label === 'allow' && row.decision === 'allow')
  );
};

/**
 * Validates that a file is a non-empty JSONL or CSV with the required
 * columns and, for every data row, a recognised `expected_label` value.
 * Mirrors pact-benchmark's runner/corpus.py: the value is lowercased before
 * comparison and must be "allow" or "block".
 */
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
    const columns = lines[0]
      .toLowerCase()
      .split(',')
      .map((c) => c.trim());
    if (!columns.includes('content') || !columns.includes('expected_label')) {
      return 'CSV must have "content" and "expected_label" columns';
    }

    const labelIndex = columns.indexOf('expected_label');
    for (let i = 1; i < lines.length; i++) {
      const cells = lines[i].split(',');
      // A naive comma split misindexes RFC-4180-quoted fields (e.g. a
      // content value containing a comma splits into extra cells) - skip the
      // label check on rows the client can't reliably parse and let the
      // server, which does proper CSV parsing, be authoritative for them.
      if (cells.length !== columns.length) continue;

      const value = cells[labelIndex]?.trim().toLowerCase() ?? '';
      if (!VALID_LABELS.includes(value)) {
        return invalidLabelError(i + 1, value);
      }
    }

    return null;
  }

  // JSONL: validate the first data line's structure, then every row's label value.
  try {
    const first = JSON.parse(lines[0]) as Record<string, unknown>;
    if (!first.content || !first.expected_label) {
      return 'Each JSONL row must have "content" and "expected_label" fields';
    }
  } catch {
    return 'First row is not valid JSON';
  }

  for (let i = 0; i < lines.length; i++) {
    let row: Record<string, unknown>;
    try {
      row = JSON.parse(lines[i]) as Record<string, unknown>;
    } catch {
      // Malformed JSON on rows past the first is reported by the gateway at
      // submit time; this client-side check only guards the label value.
      continue;
    }
    const value = String(row.expected_label ?? '').toLowerCase();
    if (!VALID_LABELS.includes(value)) {
      return invalidLabelError(i + 1, value);
    }
  }

  return null;
}

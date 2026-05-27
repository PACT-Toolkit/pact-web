export type JobStatus = 'queued' | 'running' | 'done' | 'error';

export interface BenchmarkJobState {
  status: JobStatus;
  progress_pct: number;
  error?: string;
  result?: {
    detection_rate: number;
    fp_rate: number;
    p50_latency: number;
    p99_latency: number;
    total_rows: number;
  };
}

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

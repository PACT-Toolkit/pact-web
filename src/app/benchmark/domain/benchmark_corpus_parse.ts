// Parses an uploaded corpus file into a flat column/row shape the mapping UI
// can inspect, independent of the source format (JSONL/NDJSON, a JSON array
// of objects, or CSV). This replaces the old naive comma-split CSV check in
// benchmark_job.ts, which misindexed quoted fields - see the RFC 4180 parser
// below for the fix.

export interface ParsedCorpus {
  columns: string[];
  rows: Record<string, unknown>[];
}

export type ParseCorpusResult =
  { ok: true; corpus: ParsedCorpus } | { ok: false; error: string };

const SUPPORTED_EXTENSIONS = ['jsonl', 'ndjson', 'json', 'csv'];

function fileExtension(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase();

  return ext && ext !== filename.toLowerCase() ? ext : null;
}

function collectColumns(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const columns: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        columns.push(key);
      }
    }
  }

  return columns;
}

function parseJsonlRows(text: string): ParseCorpusResult {
  const lines = text
    .split(/\r\n|\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { ok: false, error: 'File is empty' };
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < lines.length; i++) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(lines[i]);
    } catch {
      return { ok: false, error: `Row ${i + 1} is not valid JSON` };
    }
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return { ok: false, error: `Row ${i + 1} is not a JSON object` };
    }
    rows.push(parsed as Record<string, unknown>);
  }

  return { ok: true, corpus: { columns: collectColumns(rows), rows } };
}

function parseJsonArray(text: string): ParseCorpusResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON' };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, error: 'JSON file must contain an array of objects' };
  }
  if (parsed.length === 0) {
    return { ok: false, error: 'File is empty' };
  }

  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < parsed.length; i++) {
    const entry: unknown = parsed[i];
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
      return { ok: false, error: `Row ${i + 1} is not a JSON object` };
    }
    rows.push(entry as Record<string, unknown>);
  }

  return { ok: true, corpus: { columns: collectColumns(rows), rows } };
}

/**
 * RFC 4180 CSV row parser: handles quoted fields, doubled-quote escaping of a
 * literal `"`, commas and newlines embedded inside quoted fields, and both
 * CRLF and LF line endings. Returns raw string cells, one array per row.
 */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ',') {
      row.push(field);
      field = '';
      continue;
    }

    if (char === '\r' || char === '\n') {
      if (char === '\r' && text[i + 1] === '\n') {
        i += 1;
      }
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }

    field += char;
  }

  // A file without a trailing newline still has one unflushed field/row.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function parseCsv(text: string): ParseCorpusResult {
  const rawRows = parseCsvRows(text).filter(
    // Drop blank lines (a single empty cell) rather than treat them as a
    // one-column data row - the common case for a trailing newline.
    (cells) => !(cells.length === 1 && cells[0] === '')
  );

  if (rawRows.length === 0) {
    return { ok: false, error: 'File is empty' };
  }

  const columns = rawRows[0].map((c) => c.trim());
  const rows: Record<string, unknown>[] = rawRows.slice(1).map((cells) => {
    const row: Record<string, unknown> = {};
    columns.forEach((column, index) => {
      row[column] = cells[index] ?? '';
    });

    return row;
  });

  if (rows.length === 0) {
    return { ok: false, error: 'File is empty' };
  }

  return { ok: true, corpus: { columns, rows } };
}

/**
 * Parses an uploaded corpus file (JSONL/NDJSON, a JSON array of objects, or
 * CSV) into its columns and rows, so the upload form can offer a column
 * mapping step instead of assuming fixed `content`/`expected_label` names.
 */
export function parseCorpusFile(
  filename: string,
  text: string
): ParseCorpusResult {
  const ext = fileExtension(filename);
  if (!ext || !SUPPORTED_EXTENSIONS.includes(ext)) {
    return { ok: false, error: 'File must be .jsonl, .ndjson, .json, or .csv' };
  }

  if (text.trim().length === 0) {
    return { ok: false, error: 'File is empty' };
  }

  if (ext === 'csv') return parseCsv(text);
  if (ext === 'json') return parseJsonArray(text);

  return parseJsonlRows(text);
}

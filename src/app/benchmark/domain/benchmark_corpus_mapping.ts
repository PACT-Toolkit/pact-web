import { type ParsedCorpus } from '@/src/app/benchmark/domain/benchmark_corpus_parse';

// Column and value alias tables for mapping an arbitrary uploaded corpus onto
// the canonical `{id, content, kind, expected_label, category, source}` shape
// the gateway benchmark job expects. The gateway/pact-benchmark side keeps
// the same tables (see pact-benchmark's corpus alias normalisation) - keep
// both in sync if either changes.
export const TEXT_COLUMN_ALIASES = [
  'content',
  'text',
  'prompt',
  'input',
  'message',
  'query',
] as const;

export const LABEL_COLUMN_ALIASES = [
  'expected_label',
  'label',
  'type',
  'class',
  'is_injection',
  'injection',
  'malicious',
] as const;

export const BLOCK_VALUE_ALIASES = [
  'block',
  '1',
  'true',
  'injection',
  'prompt_injection',
  'jailbreak',
  'malicious',
  'attack',
  'unsafe',
  'harmful',
  'adversarial',
] as const;

export const ALLOW_VALUE_ALIASES = [
  'allow',
  '0',
  'false',
  'benign',
  'safe',
  'legit',
  'legitimate',
  'clean',
  'normal',
  'harmless',
] as const;

const ID_COLUMN_NAME = 'id';
const CATEGORY_COLUMN_NAME = 'category';
const KIND_COLUMN_NAME = 'kind';
const SOURCE_COLUMN_NAME = 'source';

const MAX_DISTINCT_LABEL_VALUES = 20;
const ID_PAD_WIDTH = 5;

export type LabelDecision = 'block' | 'allow' | 'skip';

/** The user's (or the alias tables') current text/label column selection. */
export interface CorpusColumnMapping {
  textColumn: string | null;
  labelColumn: string | null;
}

export type DistinctLabelValuesOutcome =
  | {
      ok: true;
      values: string[];
      defaultDecisions: Record<string, LabelDecision>;
    }
  | { ok: false; error: string };

export interface NormalizedCorpusRow {
  id: string;
  content: string;
  kind: 'input' | 'output';
  expected_label: 'allow' | 'block';
  category?: string;
  source?: string;
}

export interface CorpusTotals {
  total: number;
  attacks: number;
  benign: number;
  skipped: number;
}

export interface NormalizedCorpus {
  rows: NormalizedCorpusRow[];
  jsonl: string;
  totals: CorpusTotals;
}

function findColumn(columns: string[], name: string): string | null {
  const normalized = name.trim().toLowerCase();

  return (
    columns.find((column) => column.trim().toLowerCase() === normalized) ?? null
  );
}

function findAliasColumn(
  columns: string[],
  aliases: readonly string[]
): string | null {
  const normalizedColumns = columns.map((column) =>
    column.trim().toLowerCase()
  );
  for (const alias of aliases) {
    const index = normalizedColumns.indexOf(alias);
    if (index !== -1) return columns[index];
  }

  return null;
}

/**
 * Pre-selects the text and label columns from the alias tables, so a
 * canonical file (already using `content`/`expected_label`) needs no manual
 * mapping - the user only overrides it when the source file uses different
 * column names.
 */
export function detectDefaultColumnMapping(
  columns: string[]
): CorpusColumnMapping {
  return {
    textColumn: findAliasColumn(columns, TEXT_COLUMN_ALIASES),
    labelColumn: findAliasColumn(columns, LABEL_COLUMN_ALIASES),
  };
}

/**
 * Normalises a raw label cell to the string form used for both distinct-value
 * matching and vocabulary lookup. Numbers and booleans are stringified first
 * so a numeric `1`/`0` column matches the same aliases as a string one.
 */
export function stringifyLabelValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';

  return String(value).trim();
}

/**
 * Matches a raw label value against the block/allow vocabulary,
 * case-insensitively and whitespace-trimmed. Unknown values default to skip.
 */
export function matchLabelVocabulary(value: string): LabelDecision {
  const normalized = value.trim().toLowerCase();
  if (
    BLOCK_VALUE_ALIASES.includes(
      normalized as (typeof BLOCK_VALUE_ALIASES)[number]
    )
  ) {
    return 'block';
  }
  if (
    ALLOW_VALUE_ALIASES.includes(
      normalized as (typeof ALLOW_VALUE_ALIASES)[number]
    )
  ) {
    return 'allow';
  }

  return 'skip';
}

/**
 * Collects the distinct values of the chosen label column and their
 * vocabulary-derived default decision (block/allow/skip). Caps at 20 distinct
 * values - past that the column is very unlikely to actually be a label
 * column (free text, an id, etc.) and the per-value mapping UI stops being
 * useful.
 */
export function computeDistinctLabelValues(
  rows: Record<string, unknown>[],
  labelColumn: string
): DistinctLabelValuesOutcome {
  const seen = new Set<string>();
  const values: string[] = [];

  for (const row of rows) {
    const value = stringifyLabelValue(row[labelColumn]);
    if (!seen.has(value)) {
      seen.add(value);
      values.push(value);
    }
    if (values.length > MAX_DISTINCT_LABEL_VALUES) {
      return { ok: false, error: 'label column has too many distinct values' };
    }
  }

  const defaultDecisions: Record<string, LabelDecision> = {};
  for (const value of values) {
    defaultDecisions[value] = matchLabelVocabulary(value);
  }

  return { ok: true, values, defaultDecisions };
}

function generatedRowId(index: number): string {
  return `row-${String(index + 1).padStart(ID_PAD_WIDTH, '0')}`;
}

/**
 * Resolves a raw `kind` cell to the gateway's check-direction value. Only
 * "input" and "output" are recognised (case-insensitively, trimmed) - any
 * other value, a blank cell, or no `kind` column at all defaults to "input"
 * so a canonical input-only corpus needs no `kind` column at all.
 */
function resolveKind(rawKind: string): 'input' | 'output' {
  return rawKind.trim().toLowerCase() === 'output' ? 'output' : 'input';
}

/**
 * Reads an optional passthrough column (e.g. `category`, `source`) for a
 * row, returning `undefined` when the column doesn't exist or the cell is
 * absent/null/blank, so callers can spread it in only when present.
 */
function optionalColumnValue(
  sourceRow: Record<string, unknown>,
  column: string | null
): string | undefined {
  if (!column) return undefined;

  const raw = sourceRow[column];
  if (raw === undefined || raw === null) return undefined;

  const value = String(raw).trim();

  return value.length > 0 ? value : undefined;
}

/**
 * Normalises the parsed rows against the chosen text/label columns and
 * per-value decisions into the canonical shape the gateway benchmark job
 * expects: a generated id when the source has none, `kind` passed through
 * from a `kind` column (defaulting to "input"), `category` and `source`
 * passed through when present, and every other column dropped. Rows whose
 * label value maps to "skip", and rows whose text cell is blank (absent,
 * null, empty, or whitespace-only), are excluded from the output - a blank
 * row cannot be scored and the gateway rejects the whole job if one is
 * submitted - but both are still counted under `skipped` in totals.
 */
export function normalizeCorpus(
  parsed: ParsedCorpus,
  mapping: {
    textColumn: string;
    labelColumn: string;
    valueDecisions: Record<string, LabelDecision>;
  }
): NormalizedCorpus {
  const idColumn = findColumn(parsed.columns, ID_COLUMN_NAME);
  const categoryColumn = findColumn(parsed.columns, CATEGORY_COLUMN_NAME);
  const kindColumn = findColumn(parsed.columns, KIND_COLUMN_NAME);
  const sourceColumn = findColumn(parsed.columns, SOURCE_COLUMN_NAME);

  const rows: NormalizedCorpusRow[] = [];
  let attacks = 0;
  let benign = 0;
  let skipped = 0;

  parsed.rows.forEach((sourceRow, index) => {
    const rawContent = sourceRow[mapping.textColumn];
    const content =
      rawContent === undefined || rawContent === null ? '' : String(rawContent);
    const isBlankContent = content.trim().length === 0;

    const rawLabel = stringifyLabelValue(sourceRow[mapping.labelColumn]);
    const decision = mapping.valueDecisions[rawLabel] ?? 'skip';

    if (isBlankContent || decision === 'skip') {
      skipped += 1;

      return;
    }

    if (decision === 'block') attacks += 1;
    else benign += 1;

    const rawId = idColumn ? stringifyLabelValue(sourceRow[idColumn]) : '';
    const id = rawId.length > 0 ? rawId : generatedRowId(index);

    const kind = kindColumn
      ? resolveKind(stringifyLabelValue(sourceRow[kindColumn]))
      : 'input';
    const categoryValue = optionalColumnValue(sourceRow, categoryColumn);
    const sourceValue = optionalColumnValue(sourceRow, sourceColumn);

    rows.push({
      id,
      content,
      kind,
      expected_label: decision,
      ...(categoryValue !== undefined ? { category: categoryValue } : {}),
      ...(sourceValue !== undefined ? { source: sourceValue } : {}),
    });
  });

  const jsonl = rows.map((row) => JSON.stringify(row)).join('\n');

  return {
    rows,
    jsonl: jsonl.length > 0 ? `${jsonl}\n` : '',
    totals: { total: parsed.rows.length, attacks, benign, skipped },
  };
}

/** Truncates preview content to a fixed length, appending an ellipsis. */
export function truncateForPreview(text: string, maxLength = 80): string {
  if (text.length <= maxLength) return text;

  return `${text.slice(0, maxLength)}…`;
}

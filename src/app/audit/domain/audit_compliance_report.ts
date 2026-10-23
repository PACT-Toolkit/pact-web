import {
  type AuditComplianceReportEntryResponse,
  type GetAuditComplianceReportParams,
} from '@/src/__codegen__/rest/audit';
import { type RateLimitedError } from '@/src/framework/http';

// The downloadable per-decision compliance report. Pure helpers: paging the
// gateway endpoint to completion, mapping wire entries to the document shape
// and naming the file.

// Requested page size: the audit service's own maximum. The paging loop still
// never assumes a full page and advances the offset by the number of entries
// actually received.
export const COMPLIANCE_REPORT_PAGE_SIZE = 200;

// Hard ceiling on the rows one download collects. A serialized entry with one
// control is about 330 bytes (2-space indented JSON, measured), so 250_000
// rows is roughly 80 MB of string chunks plus an equal Blob copy: well inside
// browser memory limits. There is no page cap; reaching this ceiling stops the
// walk and the operator narrows the window instead of getting a partial file.
export const COMPLIANCE_REPORT_ROW_CEILING = 250_000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ComplianceReportEntry = {
  eventUuid: string;
  requestId: string;
  decision: string;
  engine: string;
  createdAtUnix: number;
  controls: { framework: string; controlId: string }[];
};

export type ComplianceReportDocument = {
  generatedAtUnix: number;
  sinceUnix: number;
  untilUnix: number;
  entries: ComplianceReportEntry[];
};

export type ComplianceReportPage = {
  entries: AuditComplianceReportEntryResponse[];
  total: number;
};

export type ComplianceReportWalkProgress = {
  pages: number;
  rows: number;
  total: number;
};

// Outcome of a walk. `completed` carries the serialized file as string chunks
// (Blob parts). `ceiling` carries no file, only the exact cut-off: rows
// fetched and the createdAt of the last row fetched (the report is newest
// first, so the rows not fetched are older than it). `failed` carries the page
// number whose fetch threw.
export type ComplianceReportWalkResult =
  | { status: 'completed'; chunks: string[]; rows: number; total: number }
  | {
      status: 'ceiling';
      rows: number;
      total: number;
      lastCreatedAt: string;
    }
  | { status: 'failed'; page: number; error: unknown };

export type ComplianceReportWalkOptions = {
  sinceUnix: number;
  untilUnix: number;
  generatedAtUnix: number;
  pageSize?: number;
  rowCeiling?: number;
  onProgress?: (progress: ComplianceReportWalkProgress) => void;
};

// Thrown by a page fetcher on any non-200 response. Carries the status so
// callers can tell the 403 permission gate from other failures, and the
// response's Retry-After header so retryOnRateLimit can honour it on a 429.
export class ComplianceReportHttpError
  extends Error
  implements RateLimitedError
{
  readonly status: number;
  readonly retryAfter: string | null;

  constructor(status: number, retryAfter: string | null = null) {
    super(`compliance report request failed with status ${status}`);
    this.name = 'ComplianceReportHttpError';
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export type ComplianceReportPageFetcher = (
  params: Required<GetAuditComplianceReportParams>
) => Promise<ComplianceReportPage>;

// The gateway sends createdAt as RFC3339; the document carries unix seconds
// like the rest of the audit API's time fields. Unparsable values map to 0.
export const toComplianceReportEntry = (
  wire: AuditComplianceReportEntryResponse
): ComplianceReportEntry => {
  const createdMs = Date.parse(wire.createdAt ?? '');

  return {
    eventUuid: wire.eventUuid ?? '',
    requestId: wire.requestId ?? '',
    decision: wire.decision ?? '',
    engine: wire.engine ?? '',
    createdAtUnix: Number.isNaN(createdMs) ? 0 : Math.floor(createdMs / 1000),
    controls: (wire.controls ?? []).map((control) => ({
      framework: control.framework ?? '',
      controlId: control.controlId ?? '',
    })),
  };
};

// The report file is JSON.stringify(document, null, 2) assembled piecewise:
// head, one chunk per page of entries, footer. Each page is serialized once
// when it arrives so no growing string and no re-serialization of earlier
// pages. An entry's pretty-printed text never contains a raw newline inside a
// string value, so indenting by line is exact.
const indentEntry = (entry: ComplianceReportEntry): string =>
  `    ${JSON.stringify(entry, null, 2).replaceAll('\n', '\n    ')}`;

const serializeReportHead = ({
  generatedAtUnix,
  sinceUnix,
  untilUnix,
}: Pick<
  ComplianceReportDocument,
  'generatedAtUnix' | 'sinceUnix' | 'untilUnix'
>): string =>
  [
    '{',
    `  "generatedAtUnix": ${JSON.stringify(generatedAtUnix)},`,
    `  "sinceUnix": ${JSON.stringify(sinceUnix)},`,
    `  "untilUnix": ${JSON.stringify(untilUnix)},`,
    '  "entries": [',
  ].join('\n');

const serializeEntriesChunk = (
  entries: ComplianceReportEntry[],
  isFirstChunk: boolean
): string =>
  `${isFirstChunk ? '\n' : ',\n'}${entries.map(indentEntry).join(',\n')}`;

const serializeReportFooter = (hasEntries: boolean): string =>
  hasEntries ? '\n  ]\n}' : ']\n}';

// Pages the report until the gateway's total is reached or an empty page
// arrives (an inconsistent total must not loop). There is no page cap; the
// walk stops with `ceiling` once rowCeiling rows are fetched and more remain.
// A fetch failure resolves as `failed` with the 1-based page number.
export const collectComplianceReportPages = async (
  fetchPage: ComplianceReportPageFetcher,
  {
    sinceUnix,
    untilUnix,
    generatedAtUnix,
    pageSize = COMPLIANCE_REPORT_PAGE_SIZE,
    rowCeiling = COMPLIANCE_REPORT_ROW_CEILING,
    onProgress,
  }: ComplianceReportWalkOptions
): Promise<ComplianceReportWalkResult> => {
  const chunks = [
    serializeReportHead({ generatedAtUnix, sinceUnix, untilUnix }),
  ];
  let rows = 0;
  let pages = 0;
  let total = 0;
  let lastCreatedAt = '';

  for (;;) {
    let result: ComplianceReportPage;
    try {
      result = await fetchPage({
        sinceUnix,
        untilUnix,
        limit: pageSize,
        offset: rows,
      });
    } catch (error) {
      return { status: 'failed', page: pages + 1, error };
    }
    total = result.total;
    if (result.entries.length === 0) break;

    chunks.push(
      serializeEntriesChunk(
        result.entries.map(toComplianceReportEntry),
        rows === 0
      )
    );
    rows += result.entries.length;
    pages += 1;
    lastCreatedAt = result.entries.at(-1)?.createdAt ?? '';
    onProgress?.({ pages, rows, total });

    if (rows >= total) break;
    if (rows >= rowCeiling) {
      return { status: 'ceiling', rows, total, lastCreatedAt };
    }
  }

  chunks.push(serializeReportFooter(rows > 0));

  return { status: 'completed', chunks, rows, total };
};

export const formatCount = (value: number): string =>
  value.toLocaleString('en-US');

// 2026-10-20 15:00:20 UTC: spaces let the sentence wrap between date and time.
const formatCutoff = (createdAt: string): string => {
  const ms = Date.parse(createdAt);

  return Number.isNaN(ms)
    ? createdAt || 'an unknown time'
    : `${new Date(ms).toISOString().slice(0, 19).replace('T', ' ')} UTC`;
};

// Plain statement of where a walk stopped at the row ceiling. `lastCreatedAt`
// is the RFC3339 timestamp of the last (oldest) row fetched.
export const complianceCeilingMessage = (
  rows: number,
  lastCreatedAt: string,
  rowCeiling: number
): string =>
  `No file produced: the ${formatCount(rowCeiling)}-row limit was reached after ${formatCount(rows)} rows. The last row fetched was recorded at ${formatCutoff(lastCreatedAt)}. Narrow the window so Until is before that time, then download again.`;

export const complianceReportFilename = (
  sinceUnix: number,
  untilUnix: number
): string => `pact-compliance-report-${sinceUnix}-${untilUnix}.json`;

const pad = (value: number): string => String(value).padStart(2, '0');

// datetime-local value (local time, minute precision) for an epoch-ms instant.
const toLocalDateTimeValue = (epochMs: number): string => {
  const d = new Date(epochMs);

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// The picker's default window: the 24 hours ending at `now`.
export const defaultComplianceWindow = (
  now: number
): { since: string; until: string } => ({
  since: toLocalDateTimeValue(now - MS_PER_DAY),
  until: toLocalDateTimeValue(now),
});

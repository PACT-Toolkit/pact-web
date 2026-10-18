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

// Hard stop for the paging loop so a misbehaving total can never spin
// forever. A window needing more pages than this is reported as truncated.
export const COMPLIANCE_REPORT_MAX_PAGES = 200;

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

export type CollectedComplianceReport = ComplianceReportPage & {
  // True when paging stopped before every entry the gateway reported was
  // received (page cap reached or an empty page arrived early).
  truncated: boolean;
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

// Pages the report until every entry is collected. Stops early on an empty
// page (an inconsistent total must not loop) and after
// COMPLIANCE_REPORT_MAX_PAGES pages; either way `truncated` tells the caller
// the result is incomplete.
export const collectComplianceReportPages = async (
  fetchPage: ComplianceReportPageFetcher,
  range: { sinceUnix: number; untilUnix: number },
  onProgress?: (collected: number, total: number) => void
): Promise<CollectedComplianceReport> => {
  const entries: AuditComplianceReportEntryResponse[] = [];
  let total = 0;

  for (let page = 0; page < COMPLIANCE_REPORT_MAX_PAGES; page++) {
    const result = await fetchPage({
      ...range,
      limit: COMPLIANCE_REPORT_PAGE_SIZE,
      offset: entries.length,
    });
    total = result.total;
    if (result.entries.length === 0) break;

    entries.push(...result.entries);
    onProgress?.(entries.length, total);
    if (entries.length >= total) break;
  }

  return { entries, total, truncated: entries.length < total };
};

export const buildComplianceReport = ({
  generatedAtUnix,
  sinceUnix,
  untilUnix,
  entries,
}: {
  generatedAtUnix: number;
  sinceUnix: number;
  untilUnix: number;
  entries: AuditComplianceReportEntryResponse[];
}): ComplianceReportDocument => ({
  generatedAtUnix,
  sinceUnix,
  untilUnix,
  entries: entries.map(toComplianceReportEntry),
});

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

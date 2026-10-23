'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { getAuditComplianceReport } from '@/src/__codegen__/rest/audit';
import {
  collectComplianceReportPages,
  complianceCeilingMessage,
  formatCount,
  COMPLIANCE_REPORT_ROW_CEILING,
  complianceReportFilename,
  ComplianceReportHttpError,
  type ComplianceReportPageFetcher,
  type ComplianceReportWalkProgress,
} from '@/src/app/audit/domain/audit_compliance_report';
import { Button } from '@/src/components/ui/button';
import { triggerDownload } from '@/src/framework/helpers/download';
import { isForbiddenError, retryOnRateLimit } from '@/src/framework/http';

export const COMPLIANCE_FORBIDDEN_MESSAGE =
  'Compliance aggregates need the audit:stats permission';

// The gateway rate-limits bursts (HTTP 429) and a long report needs many
// back-to-back pages, so each page retries on 429 through the shared policy.
const fetchReportPage: ComplianceReportPageFetcher = (params) =>
  retryOnRateLimit(async () => {
    const response = await getAuditComplianceReport(params);
    if (response.status !== 200) {
      throw new ComplianceReportHttpError(
        response.status,
        response.headers.get('retry-after')
      );
    }

    return {
      entries: response.data.entries ?? [],
      total: response.data.total ?? 0,
    };
  });

export const AuditComplianceReportDownload = ({
  sinceUnix,
  untilUnix,
  rowCeiling = COMPLIANCE_REPORT_ROW_CEILING,
}: {
  sinceUnix: number | undefined;
  untilUnix: number | undefined;
  // Test seam; production always uses the domain ceiling.
  rowCeiling?: number;
}) => {
  const [progress, setProgress] = useState<ComplianceReportWalkProgress | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleDownload = async () => {
    if (sinceUnix === undefined || untilUnix === undefined) return;

    setErrorMessage(null);
    setNotice(null);
    setProgress({ pages: 0, rows: 0, total: 0 });
    try {
      const result = await collectComplianceReportPages(fetchReportPage, {
        sinceUnix,
        untilUnix,
        generatedAtUnix: Math.floor(Date.now() / 1000),
        rowCeiling,
        onProgress: setProgress,
      });
      if (result.status === 'failed') {
        setErrorMessage(
          isForbiddenError(result.error)
            ? COMPLIANCE_FORBIDDEN_MESSAGE
            : `Failed to collect the compliance report at page ${result.page}. No file was produced. Try again in a moment.`
        );

        return;
      }
      if (result.status === 'ceiling') {
        setNotice(
          complianceCeilingMessage(
            result.rows,
            result.lastCreatedAt,
            rowCeiling
          )
        );

        return;
      }
      triggerDownload(
        new Blob(result.chunks, { type: 'application/json' }),
        complianceReportFilename(sinceUnix, untilUnix)
      );
      if (result.rows < result.total) {
        setNotice(
          `Report is incomplete: ${formatCount(result.rows)} of ${formatCount(result.total)} decisions collected. Narrow the window and download again.`
        );
      }
    } catch {
      setErrorMessage(
        'Failed to build the compliance report file. No file was produced.'
      );
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="outline"
        disabled={
          progress !== null ||
          sinceUnix === undefined ||
          untilUnix === undefined
        }
        onClick={() => void handleDownload()}
        data-testid="audit-compliance-download"
      >
        <Download aria-hidden />
        {progress
          ? `Collecting page ${formatCount(progress.pages)}: ${formatCount(progress.rows)} of ${formatCount(progress.total)} rows`
          : 'Download report'}
      </Button>
      {notice && (
        <p
          className="max-w-prose text-sm text-muted-foreground"
          role="status"
          data-testid="audit-compliance-download-notice"
        >
          {notice}
        </p>
      )}
      {errorMessage && (
        <p
          className="text-sm text-destructive"
          role="alert"
          data-testid="audit-compliance-download-error"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
};

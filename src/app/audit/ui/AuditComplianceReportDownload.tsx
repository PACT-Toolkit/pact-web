'use client';

import { Download } from 'lucide-react';
import { useState } from 'react';

import { getAuditComplianceReport } from '@/src/__codegen__/rest/audit';
import {
  buildComplianceReport,
  collectComplianceReportPages,
  complianceReportFilename,
  ComplianceReportHttpError,
  type ComplianceReportPageFetcher,
  withRateLimitRetry,
} from '@/src/app/audit/domain/audit_compliance_report';
import { Button } from '@/src/components/ui/button';
import { triggerDownload } from '@/src/framework/helpers/download';
import { isForbiddenError } from '@/src/framework/http';

export const COMPLIANCE_FORBIDDEN_MESSAGE =
  'Compliance aggregates need the audit:stats permission';

const fetchReportPage: ComplianceReportPageFetcher = withRateLimitRetry(
  async (params) => {
    const response = await getAuditComplianceReport(params);
    if (response.status !== 200) {
      throw new ComplianceReportHttpError(response.status);
    }

    return {
      entries: response.data.entries ?? [],
      total: response.data.total ?? 0,
    };
  }
);

export const AuditComplianceReportDownload = ({
  sinceUnix,
  untilUnix,
}: {
  sinceUnix: number | undefined;
  untilUnix: number | undefined;
}) => {
  const [progress, setProgress] = useState<{
    collected: number;
    total: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [truncatedNotice, setTruncatedNotice] = useState<string | null>(null);

  const handleDownload = async () => {
    if (sinceUnix === undefined || untilUnix === undefined) return;

    setErrorMessage(null);
    setTruncatedNotice(null);
    setProgress({ collected: 0, total: 0 });
    try {
      const { entries, total, truncated } = await collectComplianceReportPages(
        fetchReportPage,
        { sinceUnix, untilUnix },
        (collected, total) => setProgress({ collected, total })
      );
      const report = buildComplianceReport({
        generatedAtUnix: Math.floor(Date.now() / 1000),
        sinceUnix,
        untilUnix,
        entries,
      });
      triggerDownload(
        new Blob([JSON.stringify(report, null, 2)], {
          type: 'application/json',
        }),
        complianceReportFilename(sinceUnix, untilUnix)
      );
      if (truncated) {
        setTruncatedNotice(
          `Report is incomplete: ${entries.length} of ${total} decisions collected. Narrow the window and download again.`
        );
      }
    } catch (error) {
      setErrorMessage(
        isForbiddenError(error)
          ? COMPLIANCE_FORBIDDEN_MESSAGE
          : 'Failed to collect the compliance report. Try again in a moment.'
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
          ? `Collecting ${progress.collected} of ${progress.total}`
          : 'Download report'}
      </Button>
      {truncatedNotice && (
        <p
          className="text-sm text-muted-foreground"
          role="status"
          data-testid="audit-compliance-download-truncated"
        >
          {truncatedNotice}
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

'use client';

import { useMemo, useState } from 'react';

import { useGetAuditControlStats } from '@/src/__codegen__/rest/audit';
import { defaultComplianceWindow } from '@/src/app/audit/domain/audit_compliance_report';
import {
  isDecisionStatsFailure,
  isDecisionStatsForbidden,
} from '@/src/app/audit/domain/audit_decision_stats_access';
import { localDateTimeToUnixSeconds } from '@/src/app/audit/domain/audit_filters';
import { AuditComplianceControlStatsTable } from '@/src/app/audit/ui/AuditComplianceControlStatsTable';
import {
  AuditComplianceReportDownload,
  COMPLIANCE_FORBIDDEN_MESSAGE,
} from '@/src/app/audit/ui/AuditComplianceReportDownload';
import { AuditComplianceWindowPicker } from '@/src/app/audit/ui/AuditComplianceWindowPicker';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

export const AuditComplianceView = () => {
  const [range, setRange] = useState(() => defaultComplianceWindow(Date.now()));

  const sinceUnix = localDateTimeToUnixSeconds(range.since);
  const untilUnix = localDateTimeToUnixSeconds(range.until);
  const windowComplete = sinceUnix !== undefined && untilUnix !== undefined;

  const params = useMemo(
    () => ({ sinceUnix, untilUnix }),
    [sinceUnix, untilUnix]
  );

  // Aggregates are fetched once per range change: no polling, no refetch on
  // focus, so the totals do not shift under an operator reading them.
  const { data, error, isLoading } = useGetAuditControlStats(params, {
    swr: {
      enabled: windowComplete,
      refreshInterval: 0,
      revalidateOnFocus: false,
    },
  });

  const forbidden =
    isDecisionStatsForbidden(data) || isDecisionStatsForbidden(error);
  const failed = Boolean(error) || isDecisionStatsFailure(data);
  const stats = data?.status === 200 ? data.data : undefined;

  return (
    <Card data-testid="audit-compliance-view">
      <CardHeader className="flex flex-col gap-1">
        <CardTitle>Control totals</CardTitle>
        <CardDescription>
          Decisions per compliance control in the selected range. The
          downloadable report lists every decision with the controls it touched.
        </CardDescription>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <AuditComplianceWindowPicker
            since={range.since}
            until={range.until}
            onSinceChange={(since) => setRange((prev) => ({ ...prev, since }))}
            onUntilChange={(until) => setRange((prev) => ({ ...prev, until }))}
            onReset={() => setRange(defaultComplianceWindow(Date.now()))}
          />
          {!forbidden && (
            <AuditComplianceReportDownload
              sinceUnix={sinceUnix}
              untilUnix={untilUnix}
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {!windowComplete && (
          <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
            Set both Since and Until to see the totals.
          </p>
        )}

        {forbidden && (
          <p
            className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="audit-compliance-forbidden"
          >
            {COMPLIANCE_FORBIDDEN_MESSAGE}
          </p>
        )}

        {!forbidden && failed && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load compliance totals. Try refreshing in a moment.
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading compliance totals…
          </p>
        )}

        {stats && (
          <AuditComplianceControlStatsTable
            stats={stats.stats ?? []}
            unmapped={stats.unmapped}
          />
        )}
      </CardContent>
    </Card>
  );
};

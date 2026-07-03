'use client';

import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useQueryAuditEvents } from '@/src/__codegen__/rest/audit';
import {
  extractRedactorRecords,
  PAGE_SIZE,
} from '@/src/app/redactor/domain/redactor_record';
import { RedactorRecordCard } from '@/src/app/redactor/ui/RedactorRecordCard';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// Size of the single SWR fetch window, same cadence as the other
// pact.decisions consoles (FilterDecisionsWorkbench, ConsensusWorkbench) --
// server-side clamp is 200 (audit.Service.MaxLimit) and 30s matches the
// app-wide live-feed refresh. Distinct from PAGE_SIZE (redactor_record.ts),
// which paginates the already-fetched records client-side.
const FETCH_WINDOW_SIZE = 200;
const REFRESH_INTERVAL_MS = 30_000;

// Operational console over the redactor pipeline stage: verdict, engine,
// and per-span PII detail for every pact.decisions event whose payload
// carries a `redactor` sub-object. Sourced from the same audit feed as
// /audit, /filter, and /consensus -- no new backend endpoint, this is
// purely a different lens over pact.decisions.
export const RedactorWorkbench = () => {
  const [localPage, setLocalPage] = useState(0);

  const params = useMemo(
    () => ({
      topic: 'pact.decisions',
      limit: FETCH_WINDOW_SIZE,
    }),
    []
  );

  const { data, error, isLoading, isValidating, mutate } = useQueryAuditEvents(
    params,
    {
      swr: {
        refreshInterval: REFRESH_INTERVAL_MS,
        revalidateOnFocus: false,
        keepPreviousData: true,
      },
    }
  );

  const events = useMemo(
    () => (data?.status === 200 ? data.data.events : []),
    [data]
  );

  // Only events whose payload has a redactor sub-object become records --
  // the stage runs on (almost) every request, so this is expected to track
  // close to the full pact.decisions volume for this window.
  const records = useMemo(() => extractRedactorRecords(events), [events]);

  const redactedCount = useMemo(
    () =>
      records.filter((record) => record.redactor.verdict === 'redacted').length,
    [records]
  );

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageRecords = records.slice(
    localPage * PAGE_SIZE,
    (localPage + 1) * PAGE_SIZE
  );

  return (
    <Card data-testid="redactor-workbench">
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Redactor console</CardTitle>
            <CardDescription>
              Every request whose payload carries a redactor verdict, newest
              first. Redacted rows list the PII spans the stage removed.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void mutate()}
            disabled={isValidating}
          >
            <RefreshCw
              className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`}
              aria-hidden
            />
            Refresh
          </Button>
        </div>
        <span
          className="text-xs text-muted-foreground"
          data-testid="redactor-redacted-count"
        >
          {redactedCount} of {records.length} redacted
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load redactor events. Try refreshing in a moment.
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading redactor events…
          </p>
        )}

        {!error && !isLoading && records.length === 0 && (
          <p
            className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="redactor-empty-state"
          >
            No redactor activity recorded yet.
          </p>
        )}

        {pageRecords.length > 0 && (
          <div
            className="flex flex-col divide-y rounded-md border"
            data-testid="redactor-record-list"
          >
            {pageRecords.map((record) => (
              <RedactorRecordCard key={record.id} record={record} />
            ))}
          </div>
        )}

        {records.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="redactor-page-info">
              {`Showing ${localPage * PAGE_SIZE + 1}–${Math.min(records.length, (localPage + 1) * PAGE_SIZE)} of ${records.length}`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={localPage === 0 || isValidating}
                onClick={() => setLocalPage((p) => Math.max(0, p - 1))}
                data-testid="redactor-page-prev"
              >
                Previous
              </Button>
              <span>
                Page {localPage + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={localPage + 1 >= totalPages || isValidating}
                onClick={() => setLocalPage((p) => p + 1)}
                data-testid="redactor-page-next"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

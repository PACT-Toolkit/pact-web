'use client';

import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useQueryAuditEvents } from '@/src/__codegen__/rest/audit';
import {
  extractClassifierRecords,
  PAGE_SIZE,
} from '@/src/app/classifier/domain/classifier_record';
import { ClassifierRecordCard } from '@/src/app/classifier/ui/ClassifierRecordCard';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// Size of the single SWR fetch window, same cadence as the other
// pact.decisions consoles (FilterDecisionsWorkbench, ConsensusWorkbench,
// RedactorWorkbench) -- server-side clamp is 200 (audit.Service.MaxLimit)
// and 30s matches the app-wide live-feed refresh. Distinct from PAGE_SIZE
// (classifier_record.ts), which paginates the already-fetched records
// client-side.
const FETCH_WINDOW_SIZE = 200;
const REFRESH_INTERVAL_MS = 30_000;

// Operational console over the classifier pipeline stage (stage 2): label,
// score, engine, and whether consensus (stage 2.5) arbitrated the request,
// for every pact.decisions event whose payload carries a `classifier`
// sub-object. Sourced from the same audit feed as /audit, /filter,
// /consensus, and /redactor -- no new backend endpoint, this is purely a
// different lens over pact.decisions.
export const ClassifierWorkbench = () => {
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

  // Only events whose payload has a classifier sub-object become records --
  // the stage runs on (almost) every request, so this is expected to track
  // close to the full pact.decisions volume for this window.
  const records = useMemo(() => extractClassifierRecords(events), [events]);

  const arbitratedCount = useMemo(
    () => records.filter((record) => record.consensusArbitrated).length,
    [records]
  );

  const totalPages = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageRecords = records.slice(
    localPage * PAGE_SIZE,
    (localPage + 1) * PAGE_SIZE
  );

  return (
    <Card data-testid="classifier-workbench">
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Classifier console</CardTitle>
            <CardDescription>
              Every request whose payload carries a classifier verdict, newest
              first. Rows arbitrated by consensus are called out.
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
          data-testid="classifier-arbitrated-count"
        >
          {arbitratedCount} of {records.length} arbitrated by consensus
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load classifier events. Try refreshing in a moment.
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading classifier events…
          </p>
        )}

        {!error && !isLoading && records.length === 0 && (
          <p
            className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="classifier-empty-state"
          >
            No classifier activity recorded yet.
          </p>
        )}

        {pageRecords.length > 0 && (
          <div
            className="flex flex-col divide-y rounded-md border"
            data-testid="classifier-record-list"
          >
            {pageRecords.map((record) => (
              <ClassifierRecordCard key={record.id} record={record} />
            ))}
          </div>
        )}

        {records.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="classifier-page-info">
              {`Showing ${localPage * PAGE_SIZE + 1}–${Math.min(records.length, (localPage + 1) * PAGE_SIZE)} of ${records.length}`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={localPage === 0 || isValidating}
                onClick={() => setLocalPage((p) => Math.max(0, p - 1))}
                data-testid="classifier-page-prev"
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
                data-testid="classifier-page-next"
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

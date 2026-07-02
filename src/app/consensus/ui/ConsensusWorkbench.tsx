'use client';

import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useQueryAuditEvents } from '@/src/__codegen__/rest/audit';
import { isFlaggedRecord } from '@/src/app/consensus/domain/consensus_flags';
import {
  PAGE_SIZE,
  extractConsensusRecords,
} from '@/src/app/consensus/domain/consensus_record';
import { ConsensusRecordCard } from '@/src/app/consensus/ui/ConsensusRecordCard';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Switch } from '@/src/components/ui/switch';

// Size of the single SWR fetch window, same cadence as the other
// pact.decisions consoles (AuditWorkbench, FilterDecisionsWorkbench) --
// server-side clamp is 200 (audit.Service.MaxLimit) and 30s matches the
// app-wide live-feed refresh. Distinct from PAGE_SIZE (consensus_record.ts),
// which paginates the already-fetched records client-side, mirroring
// FilterDecisionsWorkbench's localPage pattern.
const FETCH_WINDOW_SIZE = 200;
const REFRESH_INTERVAL_MS = 30_000;

// Operational console over consensus arbitration (pipeline stage 2.5):
// per-model votes, agreement, quorum, and (whole-request) latency for every
// pact.decisions event whose payload carries a `consensus` sub-object.
// Sourced from the same audit feed as /audit and /filter -- no new backend
// endpoint, this is purely a different lens over pact.decisions.
export const ConsensusWorkbench = () => {
  const [flaggedOnly, setFlaggedOnly] = useState(false);
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

  // Only events whose payload has a consensus sub-object become records --
  // stage 2.5 didn't run for the rest (classifier score was confident
  // enough on its own). This is expected to be a small fraction of the
  // total pact.decisions volume, especially with the stub classifier
  // engine, which rarely lands in the escalation band.
  const records = useMemo(() => extractConsensusRecords(events), [events]);

  const flaggedCount = useMemo(
    () => records.filter((record) => isFlaggedRecord(record.consensus)).length,
    [records]
  );

  // Client-side only -- this is presentation over an already-fetched page,
  // not a server-side param (pact-audit's QueryEvents has no notion of
  // "flagged").
  const visibleRecords = useMemo(
    () =>
      flaggedOnly
        ? records.filter((record) => isFlaggedRecord(record.consensus))
        : records,
    [records, flaggedOnly]
  );

  const totalPages = Math.max(1, Math.ceil(visibleRecords.length / PAGE_SIZE));
  const pageRecords = visibleRecords.slice(
    localPage * PAGE_SIZE,
    (localPage + 1) * PAGE_SIZE
  );

  // Flipping the filter changes what "page 1" means -- persisting localPage
  // across the toggle would strand the user past the end of the newly
  // filtered set (same reasoning as AuditWorkbench's handleFilterChange).
  const handleFlaggedOnlyChange = (next: boolean) => {
    setLocalPage(0);
    setFlaggedOnly(next);
  };

  return (
    <Card data-testid="consensus-workbench">
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Consensus console</CardTitle>
            <CardDescription>
              Every request that escalated past the classifier into consensus
              arbitration, newest first. SPLIT / NO QUORUM / FAIL-OPEN / LOW
              CONFIDENCE rows are highlighted for operator attention.
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
        <div className="mt-4 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              size="sm"
              checked={flaggedOnly}
              onCheckedChange={handleFlaggedOnlyChange}
              aria-label="Show only flagged rows"
              data-testid="consensus-flagged-only-toggle"
            />
            Flagged only
          </label>
          <span
            className="text-xs text-muted-foreground"
            data-testid="consensus-flagged-count"
          >
            {flaggedCount} of {records.length} flagged
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load consensus events. Try refreshing in a moment.
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">
            Loading consensus events…
          </p>
        )}

        {!error && !isLoading && records.length === 0 && (
          <p
            className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="consensus-empty-state"
          >
            No consensus events yet -- no recent request escalated past the
            classifier into stage 2.5 arbitration. This is expected while the
            classifier engine resolves most requests on its own; it is not an
            error.
          </p>
        )}

        {!error &&
          !isLoading &&
          records.length > 0 &&
          visibleRecords.length === 0 && (
            <p
              className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
              data-testid="consensus-no-flagged-state"
            >
              No flagged consensus events among the {records.length} loaded --
              turn off &quot;Flagged only&quot; to see the full list.
            </p>
          )}

        {pageRecords.length > 0 && (
          <div
            className="flex flex-col divide-y rounded-md border"
            data-testid="consensus-record-list"
          >
            {pageRecords.map((record) => (
              <ConsensusRecordCard key={record.id} record={record} />
            ))}
          </div>
        )}

        {visibleRecords.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="consensus-page-info">
              {`Showing ${localPage * PAGE_SIZE + 1}–${Math.min(visibleRecords.length, (localPage + 1) * PAGE_SIZE)} of ${visibleRecords.length}`}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={localPage === 0 || isValidating}
                onClick={() => setLocalPage((p) => Math.max(0, p - 1))}
                data-testid="consensus-page-prev"
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
                data-testid="consensus-page-next"
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

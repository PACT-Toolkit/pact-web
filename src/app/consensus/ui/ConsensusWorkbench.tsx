'use client';

import { useMemo, useState } from 'react';

import { isFlaggedRecord } from '@/src/app/consensus/domain/consensus_flags';
import {
  PAGE_SIZE,
  extractConsensusRecords,
} from '@/src/app/consensus/domain/consensus_record';
import { ConsensusRecordCard } from '@/src/app/consensus/ui/ConsensusRecordCard';
import { DecisionsConsoleShell } from '@/src/components/decisions-console-shell';
import { Switch } from '@/src/components/ui/switch';
import { useDecisionsWindow } from '@/src/lib/decisions/use_decisions_window';
import { useLocalPagination } from '@/src/lib/use_local_pagination';

// Operational console over consensus arbitration (pipeline stage 2.5):
// per-model votes, agreement, quorum, and (whole-request) latency for every
// pact.decisions event whose payload carries a `consensus` sub-object.
// Sourced from the same audit feed as /audit and /filter -- no new backend
// endpoint, this is purely a different lens over pact.decisions. Chrome
// and fetch cadence live in DecisionsConsoleShell + useDecisionsWindow,
// shared with the other consoles.
export const ConsensusWorkbench = () => {
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  const { events, error, isLoading, isValidating, refresh } =
    useDecisionsWindow();

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
  // "flagged"). useLocalPagination clamps the page back into range when
  // toggling the filter shrinks the list.
  const visibleRecords = useMemo(
    () =>
      flaggedOnly
        ? records.filter((record) => isFlaggedRecord(record.consensus))
        : records,
    [records, flaggedOnly]
  );

  const pagination = useLocalPagination(visibleRecords, PAGE_SIZE);

  // Two distinct empty situations over the same slot: nothing escalated at
  // all vs. nothing flagged among the loaded records ("Flagged only" on).
  const noneLoaded = records.length === 0;

  return (
    <DecisionsConsoleShell
      stage="consensus"
      title="Consensus console"
      description="Every request that escalated past the classifier into consensus arbitration, newest first. SPLIT / NO QUORUM / FAIL-OPEN / LOW CONFIDENCE rows are highlighted for operator attention."
      headerExtra={
        <div className="mt-4 flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              size="sm"
              checked={flaggedOnly}
              onCheckedChange={setFlaggedOnly}
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
      }
      error={error}
      errorText="Failed to load consensus events. Try refreshing in a moment."
      isLoading={isLoading}
      loadingText="Loading consensus events…"
      emptyText={
        noneLoaded ? (
          <>
            No consensus events yet -- no recent request escalated past the
            classifier into stage 2.5 arbitration. This is expected while the
            classifier engine resolves most requests on its own; it is not an
            error.
          </>
        ) : (
          <>
            No flagged consensus events among the {records.length} loaded --
            turn off &quot;Flagged only&quot; to see the full list.
          </>
        )
      }
      emptyStateTestId={noneLoaded ? undefined : 'consensus-no-flagged-state'}
      isValidating={isValidating}
      onRefresh={refresh}
      pagination={pagination}
    >
      {pagination.pageItems.map((record) => (
        <ConsensusRecordCard key={record.id} record={record} />
      ))}
    </DecisionsConsoleShell>
  );
};

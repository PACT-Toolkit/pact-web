'use client';

import { useMemo } from 'react';

import {
  extractClassifierRecords,
  PAGE_SIZE,
} from '@/src/app/classifier/domain/classifier_record';
import { ClassifierRecordCard } from '@/src/app/classifier/ui/ClassifierRecordCard';
import { DecisionsConsoleShell } from '@/src/components/decisions-console-shell';
import { useDecisionsWindow } from '@/src/lib/decisions/use_decisions_window';
import { useLocalPagination } from '@/src/lib/use_local_pagination';

// Operational console over the classifier pipeline stage (stage 2): label,
// score, engine, and whether consensus (stage 2.5) arbitrated the request,
// for every pact.decisions event whose payload carries a `classifier`
// sub-object. Sourced from the same audit feed as /audit, /filter,
// /consensus, and /redactor -- no new backend endpoint, this is purely a
// different lens over pact.decisions. Chrome and fetch cadence live in
// DecisionsConsoleShell + useDecisionsWindow, shared with the other
// consoles.
export const ClassifierWorkbench = () => {
  const { events, error, isLoading, isValidating, refresh } =
    useDecisionsWindow();

  // Only events whose payload has a classifier sub-object become records --
  // the stage runs on (almost) every request, so this is expected to track
  // close to the full pact.decisions volume for this window.
  const records = useMemo(() => extractClassifierRecords(events), [events]);

  const arbitratedCount = useMemo(
    () => records.filter((record) => record.consensusArbitrated).length,
    [records]
  );

  const pagination = useLocalPagination(records, PAGE_SIZE);

  return (
    <DecisionsConsoleShell
      stage="classifier"
      title="Classifier console"
      description="Every request whose payload carries a classifier verdict, newest first. Rows arbitrated by consensus are called out."
      headerExtra={
        <span
          className="text-xs text-muted-foreground"
          data-testid="classifier-arbitrated-count"
        >
          {arbitratedCount} of {records.length} arbitrated by consensus
        </span>
      }
      error={error}
      errorText="Failed to load classifier events. Try refreshing in a moment."
      isLoading={isLoading}
      loadingText="Loading classifier events…"
      emptyText="No classifier activity recorded yet."
      isValidating={isValidating}
      onRefresh={refresh}
      pagination={pagination}
    >
      {pagination.pageItems.map((record) => (
        <ClassifierRecordCard key={record.id} record={record} />
      ))}
    </DecisionsConsoleShell>
  );
};

'use client';

import { useMemo } from 'react';

import {
  extractRedactorRecords,
  PAGE_SIZE,
} from '@/src/app/redactor/domain/redactor_record';
import { RedactorRecordCard } from '@/src/app/redactor/ui/RedactorRecordCard';
import { DecisionsConsoleShell } from '@/src/components/decisions-console-shell';
import { useDecisionsWindow } from '@/src/lib/decisions/use_decisions_window';
import { useLocalPagination } from '@/src/lib/use_local_pagination';

// Operational console over the redactor pipeline stage: verdict, engine,
// and per-span PII detail for every pact.decisions event whose payload
// carries a `redactor` sub-object. Sourced from the same audit feed as
// /audit, /filter, and /consensus -- no new backend endpoint, this is
// purely a different lens over pact.decisions. Chrome and fetch cadence
// live in DecisionsConsoleShell + useDecisionsWindow, shared with the
// other consoles.
export const RedactorWorkbench = () => {
  const { events, error, isLoading, isValidating, refresh } =
    useDecisionsWindow();

  // Only events whose payload has a redactor sub-object become records --
  // the stage runs on (almost) every request, so this is expected to track
  // close to the full pact.decisions volume for this window.
  const records = useMemo(() => extractRedactorRecords(events), [events]);

  const redactedCount = useMemo(
    () =>
      records.filter((record) => record.redactor.verdict === 'redacted').length,
    [records]
  );

  const pagination = useLocalPagination(records, PAGE_SIZE);

  return (
    <DecisionsConsoleShell
      stage="redactor"
      title="Redactor console"
      description="Every request whose payload carries a redactor verdict, newest first. Redacted rows list the PII spans the stage removed."
      headerExtra={
        <span
          className="text-xs text-muted-foreground"
          data-testid="redactor-redacted-count"
        >
          {redactedCount} of {records.length} redacted
        </span>
      }
      error={error}
      errorText="Failed to load redactor events. Try refreshing in a moment."
      isLoading={isLoading}
      loadingText="Loading redactor events…"
      emptyText="No redactor activity recorded yet."
      isValidating={isValidating}
      onRefresh={refresh}
      pagination={pagination}
    >
      {pagination.pageItems.map((record) => (
        <RedactorRecordCard key={record.id} record={record} />
      ))}
    </DecisionsConsoleShell>
  );
};

'use client';

import { useMemo, useState } from 'react';

import { AuditRow } from '@/src/app/audit/ui/AuditRow';
import {
  type DecisionRecord,
  type DecisionSeverity,
  decisionSeverity,
} from '@/src/app/dashboard/domain/dashboard_pipeline_stats';
import { RefreshButton } from '@/src/components/refresh-button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Switch } from '@/src/components/ui/switch';

type SeverityFilter = 'all' | DecisionSeverity;

const FILTERS: { value: SeverityFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'flagged', label: 'Flagged' },
];

export const DashboardLiveDecisions = ({
  records,
  isLoading,
  error,
  isValidating,
  live,
  onToggleLive,
  onRefresh,
}: {
  records: DecisionRecord[];
  isLoading?: boolean;
  error?: boolean;
  isValidating?: boolean;
  live: boolean;
  onToggleLive: (next: boolean) => void;
  onRefresh: () => void;
}) => {
  const [filter, setFilter] = useState<SeverityFilter>('all');

  const counts = useMemo(() => {
    const c = { all: records.length, blocked: 0, flagged: 0, clean: 0 };
    for (const { dp } of records) c[decisionSeverity(dp)]++;

    return c;
  }, [records]);

  const visible = useMemo(
    () =>
      filter === 'all'
        ? records
        : records.filter(({ dp }) => decisionSeverity(dp) === filter),
    [records, filter]
  );

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              live ? 'animate-pulse bg-green-500' : 'bg-muted-foreground/40'
            }`}
            aria-hidden
          />
          Live decisions
        </CardTitle>
        <div className="col-start-2 row-start-1 flex items-center gap-3 self-start justify-self-end">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Switch
              size="sm"
              checked={live}
              onCheckedChange={onToggleLive}
              aria-label="Toggle live updates"
            />
            Live
          </label>
          <RefreshButton onRefresh={onRefresh} busy={isValidating} />
        </div>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filter === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {label} {counts[value]}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-5">
        {error ? (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load decisions. Try refreshing in a moment.
          </p>
        ) : isLoading && records.length === 0 ? (
          <p className="text-sm text-muted-foreground">Loading decisions…</p>
        ) : visible.length === 0 ? (
          <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
            {records.length === 0
              ? 'No decisions recorded yet. Run a probe to generate one.'
              : 'No decisions match this filter.'}
          </p>
        ) : (
          <div className="flex max-h-[28rem] flex-col divide-y overflow-auto rounded-md border">
            {visible.map(({ event }) => (
              <AuditRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

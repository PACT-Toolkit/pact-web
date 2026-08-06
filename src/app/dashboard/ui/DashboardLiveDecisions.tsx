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
import {
  TRAFFIC_BUCKET_LABELS,
  type TrafficBucket,
  decisionTrafficBucket,
} from '@/src/lib/decisions/traffic_source';

type SourceTab = 'all' | TrafficBucket;
type SeverityFilter = 'all' | DecisionSeverity;

// Tab order is fixed: real traffic first, then the synthetic sources.
// `benchmark` and `other` only render once they have events (see below), so
// the strip stays two-tabs-plus-All in the common no-benchmark session.
const SOURCE_TAB_ORDER: TrafficBucket[] = [
  'client',
  'test_lab',
  'benchmark',
  'other',
];

const SEVERITY_FILTERS: { value: SeverityFilter; label: string }[] = [
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
  const [sourceTab, setSourceTab] = useState<SourceTab>('all');
  const [severity, setSeverity] = useState<SeverityFilter>('all');

  const bucketCounts = useMemo(() => {
    const counts: Record<TrafficBucket, number> = {
      client: 0,
      test_lab: 0,
      benchmark: 0,
      other: 0,
    };
    for (const { dp } of records) counts[decisionTrafficBucket(dp)]++;

    return counts;
  }, [records]);

  // The records in the selected source tab, before the severity filter.
  const tabRecords = useMemo(
    () =>
      sourceTab === 'all'
        ? records
        : records.filter(({ dp }) => decisionTrafficBucket(dp) === sourceTab),
    [records, sourceTab]
  );

  // Severity counts are scoped to the selected tab, so the chips always
  // describe the list under them rather than the whole window.
  const severityCounts = useMemo(() => {
    const counts = { all: tabRecords.length, blocked: 0, flagged: 0, clean: 0 };
    for (const { dp } of tabRecords) counts[decisionSeverity(dp)]++;

    return counts;
  }, [tabRecords]);

  const visible = useMemo(
    () =>
      severity === 'all'
        ? tabRecords
        : tabRecords.filter(({ dp }) => decisionSeverity(dp) === severity),
    [tabRecords, severity]
  );

  const sourceTabs = useMemo(() => {
    const buckets = SOURCE_TAB_ORDER.filter(
      // Client app and Test Lab are the console's two first-class origins and
      // always render (an empty Test Lab tab is a meaningful "no runs yet");
      // benchmark/other appear only once they hold events.
      (bucket) =>
        bucket === 'client' || bucket === 'test_lab' || bucketCounts[bucket] > 0
    );

    return [
      { value: 'all' as const, label: 'All', count: records.length },
      ...buckets.map((bucket) => ({
        value: bucket,
        label: TRAFFIC_BUCKET_LABELS[bucket],
        count: bucketCounts[bucket],
      })),
    ];
  }, [bucketCounts, records.length]);

  const emptyCopy =
    records.length === 0
      ? 'No decisions recorded yet. Run a probe to generate one.'
      : tabRecords.length === 0
        ? sourceTab === 'test_lab'
          ? 'No Test Lab decisions in the window. Run a probe or a Test Lab check.'
          : 'No decisions from this source in the window.'
        : 'No decisions match this filter.';

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
        {/* Styled as a segmented tab strip, but semantically a filter group
            (aria-pressed buttons), not ARIA tabs -- there are no tab panels,
            and role="tab" would promise arrow-key roving focus this filter
            row doesn't (and shouldn't) implement. */}
        {/* col-span-full: CardHeader is a [1fr_auto] grid (the Live/Refresh
            action pins the second column), so without it this row and the
            severity row below land in adjacent cells side by side and the
            strip clips its overflowing tabs. */}
        <div
          className="col-span-full mt-1 flex w-fit max-w-full flex-wrap gap-0.5 rounded-lg bg-muted p-0.5"
          role="group"
          aria-label="Decision source"
        >
          {sourceTabs.map(({ value, label, count }) => (
            <button
              key={value}
              type="button"
              aria-pressed={sourceTab === value}
              onClick={() => setSourceTab(value)}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                sourceTab === value
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
              <span
                className={
                  sourceTab === value
                    ? 'font-mono text-[10px] text-muted-foreground'
                    : 'font-mono text-[10px] text-muted-foreground/70'
                }
              >
                {count}
              </span>
            </button>
          ))}
        </div>
        <div
          className="col-span-full mt-1 flex flex-wrap gap-1.5"
          role="group"
          aria-label="Severity"
        >
          {SEVERITY_FILTERS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setSeverity(value)}
              aria-pressed={severity === value}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                severity === value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {label} {severityCounts[value]}
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
            {emptyCopy}
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

'use client';

import { Flag, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  type AuditEvent,
  useQueryAuditEvents,
} from '@/src/__codegen__/rest/audit';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// pact.decisions payloadJson shape. Defined here because the gateway owns this
// schema (kafka/producer.go) and there is no codegen for it today.
interface DecisionPayload {
  request_id: string;
  decision: 'allow' | 'block';
  reason?: string;
  filter_rule_id?: string;
  latency_ms: number;
}

const PAGE_SIZE = 25;

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);

  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const parsePayload = (raw: string): DecisionPayload | null => {
  try {
    return JSON.parse(raw) as DecisionPayload;
  } catch {
    return null;
  }
};

export const FilterDecisionsWorkbench = () => {
  const [localPage, setLocalPage] = useState(0);
  const [flaggedFPs, setFlaggedFPs] = useState<Set<string>>(new Set());

  const params = useMemo(
    () => ({
      topic: 'pact.decisions',
      limit: 200,
    }),
    []
  );

  const { data, error, isLoading, isValidating, mutate } = useQueryAuditEvents(
    params,
    {
      swr: {
        refreshInterval: 30_000,
        revalidateOnFocus: false,
        keepPreviousData: true,
      },
    }
  );

  const allEvents: AuditEvent[] = useMemo(
    () => (data?.status === 200 ? data.data.events : []),
    [data]
  );

  const stats = useMemo(() => {
    let blocked = 0;
    const ruleCounts: Record<string, number> = {};

    for (const evt of allEvents) {
      const payload = parsePayload(evt.payloadJson);

      if (!payload) continue;

      if (payload.decision === 'block') {
        blocked++;

        const ruleKey = payload.filter_rule_id ?? payload.reason;
        if (ruleKey) {
          ruleCounts[ruleKey] = (ruleCounts[ruleKey] ?? 0) + 1;
        }
      }
    }

    const total = allEvents.length;
    const allowed = total - blocked;
    const blockRate = total > 0 ? (blocked / total) * 100 : 0;
    const topRules = Object.entries(ruleCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    const maxRuleCount = topRules[0]?.[1] ?? 1;

    return { total, blocked, allowed, blockRate, topRules, maxRuleCount };
  }, [allEvents]);

  const totalPages = Math.max(1, Math.ceil(allEvents.length / PAGE_SIZE));
  const pageEvents = allEvents.slice(
    localPage * PAGE_SIZE,
    (localPage + 1) * PAGE_SIZE
  );

  const toggleFP = (eventId: string) => {
    setFlaggedFPs((prev) => {
      const next = new Set(prev);

      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }

      return next;
    });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total decisions" value={stats.total} />
        <StatCard
          label="Blocked"
          value={stats.blocked}
          valueClass="text-destructive"
        />
        <StatCard label="Allowed" value={stats.allowed} />
        <StatCard
          label="Block rate"
          value={`${stats.blockRate.toFixed(1)}%`}
          valueClass={stats.blockRate > 10 ? 'text-destructive' : undefined}
        />
      </div>

      {/* Top blocked rules */}
      {stats.topRules.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Top blocked rules</CardTitle>
            <CardDescription>
              Rules with the highest block counts across the most recent 200
              decisions.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {stats.topRules.map(([ruleId, count]) => (
              <div key={ruleId} className="flex items-center gap-3 text-sm">
                <span className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                  {ruleId}
                </span>
                <div className="flex flex-1 items-center gap-2">
                  <div
                    className="h-2 rounded-full bg-destructive/70"
                    style={{
                      width: `${(count / stats.maxRuleCount) * 100}%`,
                      minWidth: '4px',
                    }}
                  />
                  <span className="tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Decision list */}
      <Card>
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Recent decisions</CardTitle>
              <CardDescription>
                Newest first, auto-refreshes every 30 s. Flag a blocked decision
                as a false positive to track misclassifications.
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
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Failed to load decisions. Try refreshing in a moment.
            </p>
          )}

          {!error && !isLoading && allEvents.length === 0 && (
            <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
              No filter decisions recorded yet.
            </p>
          )}

          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading decisions…</p>
          )}

          {pageEvents.length > 0 && (
            <div className="flex flex-col divide-y rounded-md border">
              {pageEvents.map((evt) => (
                <DecisionRow
                  key={evt.id}
                  event={evt}
                  isFlagged={flaggedFPs.has(evt.id)}
                  onFlagFP={() => toggleFP(evt.id)}
                />
              ))}
            </div>
          )}

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {allEvents.length > 0
                ? `Showing ${localPage * PAGE_SIZE + 1}–${Math.min(allEvents.length, (localPage + 1) * PAGE_SIZE)} of ${allEvents.length}`
                : 'No matching rows'}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={localPage === 0 || isValidating}
                onClick={() => setLocalPage((p) => Math.max(0, p - 1))}
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
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
}) => (
  <Card>
    <CardContent className="flex flex-col gap-1 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-semibold tabular-nums ${valueClass ?? ''}`}>
        {value}
      </p>
    </CardContent>
  </Card>
);

const DecisionRow = ({
  event,
  isFlagged,
  onFlagFP,
}: {
  event: AuditEvent;
  isFlagged: boolean;
  onFlagFP: () => void;
}) => {
  const payload = useMemo(
    () => parsePayload(event.payloadJson),
    [event.payloadJson]
  );

  const isBlock = payload?.decision === 'block';

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-xs font-medium ${
              isBlock
                ? 'bg-destructive/10 text-destructive'
                : 'bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            {payload?.decision ?? '—'}
          </span>
          {(payload?.filter_rule_id ?? payload?.reason) && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {payload?.filter_rule_id ?? payload?.reason}
            </span>
          )}
          <span className="truncate font-mono text-xs text-muted-foreground">
            {event.requestId ?? payload?.request_id ?? '—'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(event.createdAt)}
          {payload?.latency_ms !== undefined
            ? ` · ${payload.latency_ms} ms`
            : ''}
        </span>
      </div>

      {isBlock && (
        <button
          type="button"
          onClick={onFlagFP}
          title={
            isFlagged ? 'Remove false-positive flag' : 'Flag as false positive'
          }
          aria-label={
            isFlagged ? 'Remove false-positive flag' : 'Flag as false positive'
          }
          className={`shrink-0 rounded p-1 transition-colors hover:bg-muted ${
            isFlagged
              ? 'text-amber-500'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Flag
            className="h-3.5 w-3.5"
            fill={isFlagged ? 'currentColor' : 'none'}
            aria-hidden
          />
        </button>
      )}
    </div>
  );
};

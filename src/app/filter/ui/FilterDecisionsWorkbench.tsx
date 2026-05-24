'use client';

import { RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  type AuditEvent,
  useQueryAuditEvents,
} from '@/src/__codegen__/rest/audit';
import { PAGE_SIZE, parsePayload } from '@/src/app/filter/domain/filter_decision';
import { FilterDecisionRow } from '@/src/app/filter/ui/FilterDecisionRow';
import { FilterStatCard } from '@/src/app/filter/ui/FilterStatCard';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

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
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <FilterStatCard label="Total decisions" value={stats.total} />
        <FilterStatCard
          label="Blocked"
          value={stats.blocked}
          valueClass="text-destructive"
        />
        <FilterStatCard label="Allowed" value={stats.allowed} />
        <FilterStatCard
          label="Block rate"
          value={`${stats.blockRate.toFixed(1)}%`}
          valueClass={stats.blockRate > 10 ? 'text-destructive' : undefined}
        />
      </div>

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
                <FilterDecisionRow
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

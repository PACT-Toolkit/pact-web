'use client';

import { useMemo } from 'react';

import {
  policyEventVerdict,
  type PolicyEvent,
} from '@/src/app/policy/domain/policy_event';
import { usePolicyEvents } from '@/src/app/policy/domain/use_policy_events';
import { PolicyStatCard } from '@/src/app/policy/ui/PolicyStatCard';
import { RefreshButton } from '@/src/components/refresh-button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { formatTimestamp } from '@/src/lib/format_timestamp';

// Live view over the caller's pact.policy decisions (GET
// /v1/audit/policy-events, PACT-306): one row per capability-token
// evaluation the gateway ran during a /v1/check request. Populated once
// pact-audit consumes the pact.policy topic (PACT-308, in flight in
// another lane) -- an empty feed in the meantime is expected, not a bug.
// Auto-refreshes every 30s, same cadence as ClassifierWorkbench and the
// other pact.decisions consoles.
export const PolicyEventsFeed = () => {
  const { events, error, isLoading, isValidating, mutate } = usePolicyEvents();

  const stats = useMemo(() => {
    const allowed = events.filter(
      (e: PolicyEvent) => policyEventVerdict(e) === 'allowed'
    ).length;
    const denied = events.filter(
      (e: PolicyEvent) => policyEventVerdict(e) === 'denied'
    ).length;
    const agents = new Set(
      events.map((e: PolicyEvent) => e.policy?.agentId).filter(Boolean)
    ).size;
    const denyRate = events.length > 0 ? (denied / events.length) * 100 : 0;

    return { allowed, denied, agents, denyRate };
  }, [events]);

  return (
    <div className="flex flex-col gap-6" data-testid="policy-events-feed">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <PolicyStatCard label="Total events" value={events.length} />
        <PolicyStatCard
          label="Allowed"
          value={stats.allowed}
          valueClass="text-green-600 dark:text-green-400"
        />
        <PolicyStatCard
          label="Denied"
          value={stats.denied}
          valueClass="text-destructive"
        />
        <PolicyStatCard
          label="Deny rate"
          value={`${stats.denyRate.toFixed(1)}%`}
          valueClass={stats.denyRate > 20 ? 'text-destructive' : undefined}
        />
        <PolicyStatCard label="Unique agents" value={stats.agents} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Policy decisions</CardTitle>
              <CardDescription>
                Requests where a capability token was evaluated. Auto-refreshes
                every 30 s.
              </CardDescription>
            </div>
            <RefreshButton
              onRefresh={() => void mutate()}
              busy={isValidating}
            />
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Failed to load policy events. Try refreshing in a moment.
            </p>
          )}

          {!error && !isLoading && events.length === 0 && (
            <p
              className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
              data-testid="policy-events-empty"
            >
              No policy-gated requests recorded yet.
            </p>
          )}

          {isLoading && (
            <p className="text-sm text-muted-foreground">Loading events…</p>
          )}

          {events.length > 0 && (
            <div
              className="flex flex-col divide-y rounded-md border text-sm"
              data-testid="policy-event-list"
            >
              {events.map((evt: PolicyEvent) => {
                const verdict = policyEventVerdict(evt);

                return (
                  <div
                    key={evt.id}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                    data-testid="policy-event-row"
                  >
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                        verdict === 'denied'
                          ? 'bg-destructive/10 text-destructive'
                          : 'bg-green-500/10 text-green-600 dark:text-green-400'
                      }`}
                    >
                      {verdict.toUpperCase()}
                    </span>
                    {evt.policy?.agentId && (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                        {evt.policy.agentId}
                      </code>
                    )}
                    {evt.policy?.toolId && (
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                        {evt.policy.toolId}
                      </code>
                    )}
                    {evt.reason && (
                      <span className="text-xs text-muted-foreground">
                        {evt.reason}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-muted-foreground">
                      {formatTimestamp(evt.createdAt, 'compact')}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

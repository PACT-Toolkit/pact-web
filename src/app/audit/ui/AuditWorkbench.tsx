'use client';

import { RefreshCw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useQueryAuditEvents } from '@/src/__codegen__/rest/audit';
import {
  AUDIT_TOPIC_OPTIONS,
  decodeAuditEventVariant,
} from '@/src/app/audit/domain/audit_event_variant';
import {
  localDateTimeToUnixSeconds,
  matchesActorFilter,
} from '@/src/app/audit/domain/audit_filters';
import { AuditRow } from '@/src/app/audit/ui/AuditRow';
import { PaginationFooter } from '@/src/components/pagination-footer';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { type Pagination } from '@/src/lib/use_local_pagination';

// Page size for the activity log. Server-side clamp is 200 (see
// audit.Service.MaxLimit) -- keep this comfortably below so a single
// network roundtrip + a few user filters can be answered without
// scrolling burning through pages.
const PAGE_SIZE = 50;

// Poll on the same cadence as the other live PACT feeds (filter decisions,
// policy events) so the activity log doesn't feel stale next to them.
// Rows are still append-only/immutable -- polling just surfaces new rows,
// it never mutates an existing one.
const REFRESH_INTERVAL_MS = 30_000;

export const AuditWorkbench = () => {
  const [topic, setTopic] = useState<string>('');
  const [requestId, setRequestId] = useState<string>('');
  const [actor, setActor] = useState<string>('');
  const [since, setSince] = useState<string>('');
  const [until, setUntil] = useState<string>('');
  const [page, setPage] = useState(0);

  // Build the query params from the current UI state. SWR re-keys on any
  // change, so flipping a filter fetches the first page with the new
  // filter automatically. topic/requestId/sinceUnix/untilUnix are all
  // genuine server-side params (pact-gateway QueryAuditEventsParams); the
  // actor filter below has no server-side equivalent and is applied
  // client-side over the returned page instead.
  const params = useMemo(() => {
    const out: Record<string, string | number | undefined> = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (topic) out.topic = topic;
    if (requestId.trim()) out.requestId = requestId.trim();
    const sinceUnix = localDateTimeToUnixSeconds(since);
    if (sinceUnix !== undefined) out.sinceUnix = sinceUnix;
    const untilUnix = localDateTimeToUnixSeconds(until);
    if (untilUnix !== undefined) out.untilUnix = untilUnix;

    return out;
  }, [topic, requestId, since, until, page]);

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
  const total = data?.status === 200 ? data.data.total : 0;

  // Actor/user has no server-side query param (see audit_filters.ts), so
  // it's applied here over the page we already fetched. This means the
  // "Showing X-Y of total" counts below reflect the server-side filters
  // only -- the actor filter narrows what's displayed on top of that.
  const filteredEvents = useMemo(
    () =>
      actor.trim()
        ? events.filter((event) =>
            matchesActorFilter(
              event,
              decodeAuditEventVariant(event.topic, event.payloadJson),
              actor
            )
          )
        : events,
    [events, actor]
  );

  // Server-side paging: the offset lives in the SWR key, so this
  // assembles the shared Pagination shape by hand instead of using
  // useLocalPagination (which paginates an already-loaded list).
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pagination: Pagination = {
    page,
    totalPages,
    totalCount: total,
    rangeStart: page * PAGE_SIZE + 1,
    rangeEnd: Math.min(total, (page + 1) * PAGE_SIZE),
    canPrev: page > 0,
    canNext: page + 1 < totalPages,
    goPrev: () => setPage((p) => Math.max(0, p - 1)),
    goNext: () => setPage((p) => p + 1),
  };

  const handleFilterChange = (next: () => void) => {
    // Any filter change resets the page -- offset is relative to the
    // current filter, not the previous one, so persisting it would jump
    // the user to a random slice of the new result set.
    setPage(0);
    next();
  };

  return (
    <Card data-testid="audit-workbench">
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Activity log</CardTitle>
            <CardDescription>
              Every audit-relevant action recorded against your account, across
              every topic PACT tracks, newest first. Rows are immutable --
              nothing here can be edited or deleted, even by you.
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
        <div className="mt-4 flex flex-wrap items-end gap-2">
          <select
            aria-label="Topic"
            value={topic}
            onChange={(event) =>
              handleFilterChange(() => setTopic(event.target.value))
            }
            className="h-9 rounded-md border bg-background px-3 text-sm"
            data-testid="audit-topic-select"
          >
            {AUDIT_TOPIC_OPTIONS.map((opt) => (
              <option key={opt.value || '__all__'} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={requestId}
              onChange={(event) =>
                handleFilterChange(() => setRequestId(event.target.value))
              }
              placeholder="Filter by request id"
              className="w-56 pl-8"
              aria-label="Request id"
            />
          </div>
          <Input
            value={actor}
            onChange={(event) => setActor(event.target.value)}
            placeholder="Filter by actor / user"
            className="w-56"
            aria-label="Actor or user"
          />
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Since
            <Input
              type="datetime-local"
              value={since}
              onChange={(event) =>
                handleFilterChange(() => setSince(event.target.value))
              }
              className="w-56"
              aria-label="Since"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Until
            <Input
              type="datetime-local"
              value={until}
              onChange={(event) =>
                handleFilterChange(() => setUntil(event.target.value))
              }
              className="w-56"
              aria-label="Until"
            />
          </label>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load activity. Try refreshing in a moment.
          </p>
        )}

        {!error && filteredEvents.length === 0 && !isLoading && (
          <p
            className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="audit-empty-state"
          >
            {topic === 'pact.policy'
              ? "pact.policy events aren't recorded in the audit log yet -- pact-audit doesn't consume that topic yet."
              : 'No audit events match these filters yet.'}
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        )}

        {filteredEvents.length > 0 && (
          <div
            className="flex flex-col divide-y rounded-md border"
            data-testid="audit-row-list"
          >
            {filteredEvents.map((event) => (
              <AuditRow key={event.id} event={event} />
            ))}
          </div>
        )}

        <PaginationFooter
          pagination={pagination}
          busy={isValidating}
          testIdPrefix="audit"
          emptyText="No matching rows"
        />
      </CardContent>
    </Card>
  );
};

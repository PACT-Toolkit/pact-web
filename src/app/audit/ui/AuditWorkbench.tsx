'use client';

import { ChevronDown, ChevronUp, RefreshCw, Search } from 'lucide-react';
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
import { Input } from '@/src/components/ui/input';

// Page size for the activity log. Server-side clamp is 200 (see
// audit.Service.MaxLimit) -- keep this comfortably below so a single
// network roundtrip + a few user filters can be answered without
// scrolling burning through pages.
const PAGE_SIZE = 50;

// Canonical topics today. Free-form on the wire, but a select beats
// a free-text field for the common cases. "All" maps to no filter.
const TOPIC_OPTIONS = [
  { value: '', label: 'All topics' },
  { value: 'pact.auth', label: 'pact.auth (sign-in / passkey / MFA)' },
  { value: 'pact.account', label: 'pact.account (profile / consents / GDPR)' },
  { value: 'pact.files', label: 'pact.files (upload lifecycle)' },
  { value: 'pact.decisions', label: 'pact.decisions (allow / block calls)' },
];

const formatTimestamp = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Pretty-print the JSONB payload string. We don't trust the server
// to have already formatted it (it's raw from the audit_events
// column) so JSON.parse + JSON.stringify normalises it. If the
// payload isn't valid JSON we fall back to the raw string -- a row
// with a malformed payload is itself diagnostic and shouldn't crash
// the viewer.
const prettyPayload = (raw: string): string => {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as unknown;

    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
};

export const AuditWorkbench = () => {
  const [topic, setTopic] = useState<string>('');
  const [requestId, setRequestId] = useState<string>('');
  const [page, setPage] = useState(0);

  // Build the query params from the current UI state. SWR re-keys
  // on any change, so flipping `topic` or `requestId` fetches the
  // first page with the new filter automatically.
  const params = useMemo(() => {
    const out: Record<string, string | number | undefined> = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (topic) out.topic = topic;
    if (requestId.trim()) out.requestId = requestId.trim();

    return out;
  }, [topic, requestId, page]);

  const { data, error, isLoading, isValidating, mutate } = useQueryAuditEvents(
    params,
    {
      swr: {
        // Audit rows are append-only on the server -- once a row
        // appears it never changes -- so we don't poll. The user
        // hits the refresh button when they want a fresh page.
        revalidateOnFocus: false,
        revalidateIfStale: false,
        keepPreviousData: true,
      },
    }
  );

  const events: AuditEvent[] = data?.status === 200 ? data.data.events : [];
  const total = data?.status === 200 ? data.data.total : 0;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = page * PAGE_SIZE + 1;
  const pageEnd = Math.min(total, (page + 1) * PAGE_SIZE);

  const handleFilterChange = (next: () => void) => {
    // Any filter change resets the page -- offset is relative to
    // the current filter, not the previous one, so persisting it
    // would jump the user to a random slice of the new result set.
    setPage(0);
    next();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-1">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <CardTitle>Activity log</CardTitle>
            <CardDescription>
              Every audit-relevant action recorded against your account, newest
              first. Rows are immutable -- nothing here can be edited or
              deleted, even by you.
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
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <select
            aria-label="Topic"
            value={topic}
            onChange={(event) =>
              handleFilterChange(() => setTopic(event.target.value))
            }
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {TOPIC_OPTIONS.map((opt) => (
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
              className="w-64 pl-8"
              aria-label="Request id"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Failed to load activity. Try refreshing in a moment.
          </p>
        )}

        {!error && events.length === 0 && !isLoading && (
          <p className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
            No audit events match these filters yet.
          </p>
        )}

        {isLoading && (
          <p className="text-sm text-muted-foreground">Loading activity…</p>
        )}

        {events.length > 0 && (
          <div className="flex flex-col divide-y rounded-md border">
            {events.map((event) => (
              <AuditRow key={event.id} event={event} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {total > 0
              ? `Showing ${pageStart}–${pageEnd} of ${total}`
              : 'No matching rows'}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || isValidating}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page + 1 >= totalPages || isValidating}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const AuditRow = ({ event }: { event: AuditEvent }) => {
  const [open, setOpen] = useState(false);
  const pretty = useMemo(
    () => prettyPayload(event.payloadJson),
    [event.payloadJson]
  );

  return (
    <div className="flex flex-col gap-2 p-4 text-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={open}
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {event.topic}
            </span>
            <span className="font-medium">
              {event.eventId || '(no event id)'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(event.createdAt)}
            {event.requestId ? ` · request ${event.requestId}` : ''}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
      </button>
      {open && (
        <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
          {pretty || '(empty payload)'}
        </pre>
      )}
    </div>
  );
};

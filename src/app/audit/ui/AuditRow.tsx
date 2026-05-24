'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useMemo, useState } from 'react';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { parseDecisionPayload } from '@/src/app/audit/domain/audit_decision_payload';
import { AuditDecisionInsights } from '@/src/app/audit/ui/AuditDecisionInsights';

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

// Pretty-print the JSONB payload string. If the payload isn't valid
// JSON we fall back to the raw string -- a malformed row is itself
// diagnostic and shouldn't crash the viewer.
const prettyPayload = (raw: string): string => {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as unknown;

    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
};

export const AuditRow = ({ event }: { event: AuditEvent }) => {
  const [open, setOpen] = useState(false);
  const pretty = useMemo(
    () => prettyPayload(event.payloadJson),
    [event.payloadJson]
  );
  const dp = useMemo(
    () => event.topic === 'pact.decisions' ? parseDecisionPayload(event.payloadJson) : null,
    [event.topic, event.payloadJson]
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
            {dp?.decision && (
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                  dp.decision === 'block'
                    ? 'bg-destructive/10 text-destructive'
                    : 'bg-green-500/10 text-green-600 dark:text-green-400'
                }`}
              >
                {dp.decision.toUpperCase()}
              </span>
            )}
            {dp?.reason && (
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                {dp.reason}
              </code>
            )}
            {!dp && (
              <span className="font-medium">
                {event.eventId || '(no event id)'}
              </span>
            )}
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
        <div className="flex flex-col gap-2">
          {dp && <AuditDecisionInsights dp={dp} />}
          <pre className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs">
            {pretty || '(empty payload)'}
          </pre>
        </div>
      )}
    </div>
  );
};

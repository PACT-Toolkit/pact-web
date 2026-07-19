'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { formatTimestamp } from '@/src/lib/format_timestamp';

// Shared chrome for every audit row, regardless of topic: the clickable
// header (topic pill + per-topic badges + timestamp), the expand/collapse
// chevron, and the expanded body (optional per-topic insights, always
// followed by the pretty-printed raw JSON so an operator can fall back to
// the source of truth for any topic, decoded or not).
export const AuditRowShell = ({
  topic,
  createdAt,
  requestId,
  badges,
  detail,
  rawPayload,
}: {
  topic: string;
  createdAt: string;
  requestId?: string;
  badges: ReactNode;
  detail?: ReactNode;
  rawPayload: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2 p-4 text-sm" data-testid="audit-row">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
        aria-expanded={open}
        data-testid="audit-row-toggle"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {topic}
            </span>
            {badges}
          </div>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(createdAt)}
            {requestId ? ` · request ${requestId}` : ''}
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
          {detail}
          <pre
            className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs"
            data-testid="audit-row-raw-payload"
          >
            {rawPayload || '(empty payload)'}
          </pre>
        </div>
      )}
    </div>
  );
};

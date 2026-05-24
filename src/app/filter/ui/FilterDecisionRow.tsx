'use client';

import { Flag } from 'lucide-react';
import { useMemo } from 'react';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { formatTimestamp, parsePayload } from '@/src/app/filter/domain/filter_decision';

export const FilterDecisionRow = ({
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

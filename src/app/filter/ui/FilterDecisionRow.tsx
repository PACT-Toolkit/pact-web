'use client';

import { Flag } from 'lucide-react';
import { useMemo } from 'react';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { parsePayload } from '@/src/app/filter/domain/filter_decision';
import { formatTimestamp } from '@/src/lib/format_timestamp';

export const FilterDecisionRow = ({
  event,
  isFlagged,
  isFlagging,
  flagFailed,
  onFlagFP,
}: {
  event: AuditEvent;
  isFlagged: boolean;
  isFlagging: boolean;
  flagFailed: boolean;
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
          {(payload?.filter?.rule_id ?? payload?.reason) && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
              {payload?.filter?.rule_id ?? payload?.reason}
            </span>
          )}
          <span className="truncate font-mono text-xs text-muted-foreground">
            {event.requestId ?? payload?.request_id ?? '—'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatTimestamp(event.createdAt, 'compact')}
          {payload?.latency_ms !== undefined
            ? ` · ${payload.latency_ms} ms`
            : ''}
        </span>
      </div>

      {isBlock && (
        <div className="flex shrink-0 items-center gap-2">
          {flagFailed && !isFlagged && (
            <span className="text-xs text-destructive">
              Flag failed. Try again.
            </span>
          )}
          <button
            type="button"
            onClick={onFlagFP}
            disabled={isFlagged || isFlagging}
            title={
              isFlagged ? 'Flagged as false positive' : 'Flag as false positive'
            }
            aria-label={
              isFlagged ? 'Flagged as false positive' : 'Flag as false positive'
            }
            data-testid="filter-decision-flag-fp"
            className={`rounded p-1 transition-colors hover:bg-muted disabled:cursor-not-allowed ${
              isFlagged
                ? 'text-amber-500'
                : 'text-muted-foreground hover:text-foreground'
            } ${isFlagging ? 'animate-pulse' : ''}`}
          >
            <Flag
              className="h-3.5 w-3.5"
              fill={isFlagged ? 'currentColor' : 'none'}
              aria-hidden
            />
          </button>
        </div>
      )}
    </div>
  );
};

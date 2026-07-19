'use client';

import { ChevronDown, ChevronUp, Eraser } from 'lucide-react';
import { useState } from 'react';

import { type RedactorRecord } from '@/src/app/redactor/domain/redactor_record';
import { RedactorSpanList } from '@/src/app/redactor/ui/RedactorSpanList';
import { formatTimestamp } from '@/src/lib/format_timestamp';

// One redactor-stage decision: verdict badge, engine, span count, and a
// collapsible detail panel listing each redacted span's entity type and
// byte offsets. Visually mirrors the badge-row layout of
// ConsensusRecordCard / AuditDecisionInsights without reusing either
// directly -- this card's expand target is the span table (RedactorSpanList)
// rather than a raw-JSON fallback, so it gets its own small toggle instead
// of reusing ConsensusRawPayloadToggle.
export const RedactorRecordCard = ({ record }: { record: RedactorRecord }) => {
  const [expanded, setExpanded] = useState(false);
  const { redactor } = record;
  const redacted = redactor.verdict === 'redacted';
  const spans = redactor.spans ?? [];

  return (
    <div
      className="flex flex-col gap-2 p-4 text-sm"
      data-testid="redactor-record-card"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
              redacted
                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                : 'bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            <Eraser className="h-3 w-3" aria-hidden />
            {redactor.verdict ?? 'unknown'}
          </span>
          {record.engine && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
              {record.engine}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {spans.length} span{spans.length === 1 ? '' : 's'}
          </span>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatTimestamp(record.createdAt)}
          {record.requestId ? ` · request ${record.requestId}` : ''}
          {typeof record.latencyMs === 'number'
            ? ` · ${record.latencyMs} ms request latency`
            : ''}
        </span>
      </div>

      {spans.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-expanded={expanded}
            data-testid="redactor-span-detail-toggle"
          >
            {expanded ? (
              <ChevronUp className="h-3 w-3" aria-hidden />
            ) : (
              <ChevronDown className="h-3 w-3" aria-hidden />
            )}
            {expanded ? 'Hide' : 'Show'} span detail
          </button>
          {expanded && (
            <div data-testid="redactor-span-detail-pane">
              <RedactorSpanList spans={spans} />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

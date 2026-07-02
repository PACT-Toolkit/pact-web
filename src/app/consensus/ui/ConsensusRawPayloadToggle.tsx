'use client';

import { ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

import { prettyPayload } from '@/src/app/audit/domain/audit_event_variant';

// Collapsible raw-JSON fallback for one consensus record (PACT-369).
// Visually mirrors AuditRowShell's expand/collapse chrome on /audit rather
// than reusing it directly -- ConsensusRecordCard's layout (badge row +
// vote chips) doesn't nest inside AuditRowShell's header/body split, so
// this is a small dedicated toggle instead. prettyPayload is a
// cross-feature domain import (app -> app), already an established pattern
// in this codebase (see consensus_record.ts's re-derivation of
// DecisionPayload).
export const ConsensusRawPayloadToggle = ({
  rawPayload,
}: {
  rawPayload: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        aria-expanded={open}
        data-testid="consensus-raw-payload-toggle"
      >
        {open ? (
          <ChevronUp className="h-3 w-3" aria-hidden />
        ) : (
          <ChevronDown className="h-3 w-3" aria-hidden />
        )}
        Raw payload
      </button>
      {open && (
        <pre
          className="max-h-72 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs"
          data-testid="consensus-raw-payload-pane"
        >
          {prettyPayload(rawPayload) || '(empty payload)'}
        </pre>
      )}
    </div>
  );
};

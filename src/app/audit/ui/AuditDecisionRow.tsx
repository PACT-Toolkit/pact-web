import { Shield } from 'lucide-react';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { prettyPayload } from '@/src/app/audit/domain/audit_event_variant';
import { AuditDecisionInsights } from '@/src/app/audit/ui/AuditDecisionInsights';
import { AuditRowShell } from '@/src/app/audit/ui/AuditRowShell';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

// Row renderer for pact.decisions -- the allow/block engine calls. Badges
// surface the decision itself plus the reason and classifier label, since
// those are what an operator scans for first; everything else lives in
// AuditDecisionInsights behind the expand toggle.
export const AuditDecisionRow = ({
  event,
  payload,
}: {
  event: AuditEvent;
  payload: DecisionPayload;
}) => (
  <AuditRowShell
    topic={event.topic}
    createdAt={event.createdAt}
    requestId={event.requestId}
    rawPayload={prettyPayload(event.payloadJson)}
    detail={<AuditDecisionInsights dp={payload} />}
    badges={
      <>
        {payload.decision && (
          <span
            className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
              payload.decision === 'block'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            {payload.decision.toUpperCase()}
          </span>
        )}
        {payload.reason && (
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {payload.reason}
          </code>
        )}
        {payload.classifier?.label && (
          <code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400">
            {payload.classifier.label}
          </code>
        )}
        {payload.policy?.verdict && (
          <Shield
            className="h-3.5 w-3.5 text-muted-foreground"
            aria-label={`policy: ${payload.policy.verdict}`}
          />
        )}
        {!payload.decision && (
          <span className="font-medium">
            {event.eventId || '(no event id)'}
          </span>
        )}
      </>
    }
  />
);

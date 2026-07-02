import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  ACCOUNT_EVENT_LABELS,
  type AccountPayload,
} from '@/src/app/audit/domain/audit_account_payload';
import { prettyPayload } from '@/src/app/audit/domain/audit_event_variant';
import { AuditRowShell } from '@/src/app/audit/ui/AuditRowShell';

// Row renderer for pact.account -- profile, consent, and GDPR-erasure
// events. Badges surface the human event label plus the consent
// document/granted flag when present, since erasure and consent rows are
// the ones most often audited after the fact.
export const AuditAccountRow = ({
  event,
  payload,
}: {
  event: AuditEvent;
  payload: AccountPayload;
}) => {
  const eventId = payload.event_id;
  const label = eventId ? (ACCOUNT_EVENT_LABELS[eventId] ?? eventId) : null;

  return (
    <AuditRowShell
      topic={event.topic}
      createdAt={event.createdAt}
      requestId={event.requestId}
      rawPayload={prettyPayload(event.payloadJson)}
      badges={
        <>
          {label && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
              {label}
            </span>
          )}
          {payload.document && (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {payload.document}
              {payload.version ? `@${payload.version}` : ''}
            </code>
          )}
          {payload.granted !== undefined && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                payload.granted
                  ? 'bg-green-500/10 text-green-600 dark:text-green-400'
                  : 'bg-destructive/10 text-destructive'
              }`}
            >
              {payload.granted ? 'GRANTED' : 'REVOKED'}
            </span>
          )}
          {!label && (
            <span className="font-medium">
              {event.eventId || '(no event id)'}
            </span>
          )}
        </>
      }
    />
  );
};

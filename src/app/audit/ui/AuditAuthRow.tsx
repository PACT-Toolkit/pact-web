import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  AUTH_EVENT_LABELS,
  type AuthPayload,
} from '@/src/app/audit/domain/audit_auth_payload';
import { prettyPayload } from '@/src/app/audit/domain/audit_event_variant';
import { AuditRowShell } from '@/src/app/audit/ui/AuditRowShell';

// Row renderer for pact.auth -- sign-in, passkey, and MFA lifecycle
// events. Badges surface the human event label plus the auth method and
// email, since those are what an operator scans for first when chasing a
// failed or suspicious login.
export const AuditAuthRow = ({
  event,
  payload,
}: {
  event: AuditEvent;
  payload: AuthPayload;
}) => {
  const eventId = payload.event_id;
  const label = eventId ? (AUTH_EVENT_LABELS[eventId] ?? eventId) : null;
  const isFailure =
    eventId === 'login_failed' || eventId === 'login_unverified';

  return (
    <AuditRowShell
      topic={event.topic}
      createdAt={event.createdAt}
      requestId={event.requestId}
      rawPayload={prettyPayload(event.payloadJson)}
      badges={
        <>
          {label && (
            <span
              className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                isFailure
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400'
              }`}
            >
              {label}
            </span>
          )}
          {payload.method && (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {payload.method}
            </code>
          )}
          {payload.provider && (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {payload.provider}
            </code>
          )}
          {payload.email && (
            <code className="rounded bg-blue-500/10 px-1.5 py-0.5 text-xs text-blue-600 dark:text-blue-400">
              {payload.email}
            </code>
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

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { prettyPayload } from '@/src/app/audit/domain/audit_event_variant';
import { AuditRowShell } from '@/src/app/audit/ui/AuditRowShell';

// Fallback row for a topic pact-web doesn't have a decoder for yet (e.g.
// pact.policy, ahead of PACT-306/308) or a payload that failed to decode
// against its topic's expected shape. Never hides the row -- the raw JSON
// panel is always available, same as every other topic.
export const AuditUnknownRow = ({
  event,
  raw,
}: {
  event: AuditEvent;
  raw: string;
}) => (
  <AuditRowShell
    topic={event.topic}
    createdAt={event.createdAt}
    requestId={event.requestId}
    rawPayload={prettyPayload(raw)}
    badges={
      <span className="font-medium">{event.eventId || '(no event id)'}</span>
    }
  />
);

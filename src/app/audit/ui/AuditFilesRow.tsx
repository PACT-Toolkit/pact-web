import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { prettyPayload } from '@/src/app/audit/domain/audit_event_variant';
import {
  FILES_EVENT_LABELS,
  type FilesPayload,
} from '@/src/app/audit/domain/audit_files_payload';
import { AuditRowShell } from '@/src/app/audit/ui/AuditRowShell';

const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Row renderer for pact.files -- upload lifecycle events. Unlike
// pact.auth/pact.account, the semantic event name is event_type, not
// event_id (event_id is a per-event dedup UUID on this topic).
export const AuditFilesRow = ({
  event,
  payload,
}: {
  event: AuditEvent;
  payload: FilesPayload;
}) => {
  const eventType = payload.event_type;
  const label = eventType ? (FILES_EVENT_LABELS[eventType] ?? eventType) : null;
  const isRejectedOrDeleted =
    eventType === 'file_rejected' || eventType === 'file_deleted';

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
                isRejectedOrDeleted
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-600 dark:text-green-400'
              }`}
            >
              {label}
            </span>
          )}
          {payload.filename && (
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {payload.filename}
            </code>
          )}
          {typeof payload.size_bytes === 'number' && payload.size_bytes > 0 && (
            <span className="text-xs text-muted-foreground">
              {formatBytes(payload.size_bytes)}
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

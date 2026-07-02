// Shape of the JSON pact-files' Kafka producer emits on topic pact.files.
// Matches pact-files internal/events/producer.go FileEvent -- decoded
// lazily; unknown/missing fields are tolerated per the audit schema
// contract.
//
// Unlike pact.auth/pact.account, event_id here is a per-event dedup UUID,
// not a semantic name -- the semantic name lives in event_type.
export interface FilesPayload {
  event_id?: string;
  event_type?: string;
  user_id?: string;
  file_id?: string;
  filename?: string;
  content_type?: string;
  size_bytes?: number;
  purpose?: string;
  status?: string;
  storage_key?: string;
  thumbnail_key?: string;
  extras?: Record<string, string>;
  created_at?: string;
}

export const FILES_EVENT_LABELS: Record<string, string> = {
  file_ready: 'File ready',
  file_rejected: 'File rejected',
  file_deleted: 'File deleted',
};

export const decodeFilesPayload = (raw: string): FilesPayload | null => {
  try {
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null;

    return p as FilesPayload;
  } catch {
    return null;
  }
};

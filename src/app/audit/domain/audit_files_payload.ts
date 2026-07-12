import { type PactFiles } from '@/src/__codegen__/schema/pact-files';

// Shape of the JSON pact-files' Kafka producer emits on topic pact.files,
// generated from pact-contracts' files/pact.files.schema.json (PACT-575) --
// see src/__codegen__/schema/pact-files/. Matches pact-files
// internal/events/producer.go FileEvent; decoded lazily.
//
// Partial<>, not the bare generated PactFiles: the wire schema marks
// event_id/event_type/file_id/status/created_at as required (always present
// on a real Kafka payload), but this type is also used to type payload
// *drafts* being built up incrementally by the mock seeder
// (mock/data/audit.ts). Every field keeps its precise generated shape
// (closed enums included) -- only top-level presence is relaxed.
//
// Unlike pact.auth/pact.account, event_id here is a per-event dedup UUID,
// not a semantic name -- the semantic name lives in event_type.
export type FilesPayload = Partial<PactFiles>;

// Human labels for the pact-files event_type constants -- NOT event_id,
// which is the dedup UUID on this topic (see FilesPayload's doc comment
// above). Keyed on the schema's own closed event_type union (not a
// hand-copied string list) -- an upstream vocabulary change fails typecheck
// here instead of silently falling back to the raw value in the UI. Falls
// back to the raw value at runtime for any payload whose event_type doesn't
// match this build's schema -- never throws, never hides an unrecognised
// event.
export const FILES_EVENT_LABELS: Record<PactFiles['event_type'], string> = {
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

/**
 * Auto-generated from pact-contracts' vendored pact.files.schema.json
 * (schema/pact-files/pact.files.schema.json).
 * Do not edit files.ts manually - run `pnpm schema:codegen` to regenerate.
 */

/**
 * Canonical wire schema for the pact.files Kafka topic, mirroring pact-files' internal/events/producer.go FileEvent. Field names and required/optional status are frozen - pact-audit pins this shape. additionalProperties is false at every level so an accidental field rename or addition fails validation instead of silently passing through as unrecognised JSONB. NOTE: on this topic event_id is the per-event dedup UUID and event_type carries the semantic event name - the opposite of the pact.auth/pact.account topic conventions.
 */
export interface PactFiles {
  /**
   * Per-event dedup UUID, freshly minted for every published event (uuid.NewString()). Does NOT name the event kind - see event_type.
   */
  event_id: string;
  /**
   * Semantic event name - closed set. Every buildOutboxPayload call site in pact-files uses one of these three; a terminal lifecycle transition emits exactly one such event.
   */
  event_type: "file_ready" | "file_rejected" | "file_deleted";
  user_id?: string;
  file_id: string;
  filename?: string;
  content_type?: string;
  size_bytes?: number;
  /**
   * Caller-declared upload purpose tag (e.g. "avatar"). Open set by design.
   */
  purpose?: string;
  /**
   * Closed set - the terminal file status this event announces, matching event_type. pact-files' file.Status type also has pending/processing values, but only a terminal transition ever publishes a pact.files event, so those two never appear on the wire.
   */
  status: "ready" | "rejected" | "deleted";
  storage_key?: string;
  thumbnail_key?: string;
  /**
   * Event-specific metadata that does not warrant its own wire field. Open set by design - known keys today: "reason" (file_rejected, e.g. mime_mismatch/virus/size_exceeded), "actor" (file_deleted, "user" | "ttl"), "mime" (file_ready, detected MIME type).
   */
  extras?: {
    [k: string]: string;
  };
  created_at: string;
}

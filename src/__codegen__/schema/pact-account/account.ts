/**
 * Auto-generated from pact-contracts' vendored pact.account.schema.json
 * (schema/pact-account/pact.account.schema.json).
 * Do not edit account.ts manually - run `pnpm schema:codegen` to regenerate.
 */

/**
 * Canonical wire schema for the pact.account Kafka topic, mirroring internal/kafka/producer.go AccountEvent. Field names and required/optional status are frozen per ENGINEERING.md - every consumer of this topic pins this shape. additionalProperties is false so an accidental field rename or addition fails validation instead of silently passing through as unrecognised JSON.
 */
export interface PactAccount {
  /**
   * Per-event dedup key. Auto-filled by Producer.Publish when the caller leaves it empty (and always set explicitly on the transactional-outbox path), but omitempty on the Go struct means a caller that marshals an AccountEvent directly can still produce a wire event missing this key.
   */
  event_uuid?: string;
  /**
   * Closed set - pact-account's internal/kafka.EvtXxx constants only ever produce these four values.
   */
  event_id: "user_erasure_requested" | "consent_recorded" | "profile_updated" | "preferences_updated";
  user_id?: string;
  request_id?: string;
  created_at: string;
  /**
   * Compliance document identifier (e.g. privacy_policy, terms_of_service). Set together with version and granted on consent_recorded events; recorded for evidence per GDPR Art. 7(1).
   */
  document?: string;
  /**
   * Version of document the consent applies to. Set together with document and granted on consent_recorded events.
   */
  version?: string;
  /**
   * Whether consent was granted. Carries omitempty on the Go struct, so false is dropped from the wire exactly like an unset value - consumers MUST treat an absent granted key as false, not as "unknown". Set together with document and version on consent_recorded events.
   */
  granted?: boolean;
}

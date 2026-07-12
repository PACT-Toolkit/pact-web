/**
 * Auto-generated from pact-contracts' vendored pact.auth.schema.json
 * (schema/pact-auth/pact.auth.schema.json).
 * Do not edit auth.ts manually - run `pnpm schema:codegen` to regenerate.
 */

/**
 * Canonical wire schema for the pact.auth Kafka topic, mirroring internal/kafka/producer.go AuthEvent. Field names and required/optional status are frozen - pact-notify and pact-account pin this shape. additionalProperties is false at the top level so an accidental field rename or addition fails validation instead of silently passing through unrecognised.
 */
export interface PactAuth {
  /**
   * Autopopulated by pact-auth's EnqueueEvent when the caller leaves it empty; used by downstream consumers as the dedup key.
   */
  event_uuid?: string;
  /**
   * Closed set - pact-auth's internal/kafka/producer.go Evt* constants (this module's auth.Evt* constants) only ever produce these ten values.
   */
  event_id:
    | "login_started"
    | "login_succeeded"
    | "login_failed"
    | "login_unverified"
    | "register_succeeded"
    | "email_verification_requested"
    | "email_verified"
    | "password_set_link_requested"
    | "password_reset_requested"
    | "password_changed";
  user_id?: string;
  /**
   * OAuth provider name (e.g. google, github). Open set - pact-auth can register a new OAuth provider without a schema change. Absent on password-flow events.
   */
  provider?: string;
  request_id?: string;
  created_at: string;
  /**
   * Email + password flow field. Only set on relevant events (email_verification_requested / password_*_link_requested / etc.).
   */
  email?: string;
  /**
   * The non-secret auth_tokens row id, not the wire token itself (PACT-515). See this schema's top-level $comment.
   */
  token_id?: string;
  return_to?: string;
  expires_at?: string;
  /**
   * Closed set - mirrors pact-auth's producer.go inline comment ("password" | "oauth"); this module's auth.MethodPassword / auth.MethodOAuth constants.
   */
  method?: "password" | "oauth";
  ip?: string;
  /**
   * Profile seed value captured at sign-up (or first OAuth login). Set on register_succeeded so pact-account can materialise the profile row with useful initial values; absent on every other event.
   */
  display_name?: string;
  /**
   * Profile seed value, same population rule as display_name.
   */
  avatar_url?: string;
}

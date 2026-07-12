import { type PactAuth } from '@/src/__codegen__/schema/pact-auth';

// Shape of the JSON pact-auth's Kafka producer emits on topic pact.auth,
// generated from pact-contracts' auth/pact.auth.schema.json (PACT-575) --
// see src/__codegen__/schema/pact-auth/. Matches pact-auth
// internal/kafka/producer.go AuthEvent; decoded lazily.
//
// Partial<>, not the bare generated PactAuth: the wire schema marks
// event_id/created_at as required (always present on a real Kafka payload),
// but this type is also used to type payload *drafts* being built up
// incrementally by the mock seeder (mock/data/audit.ts), which assembles a
// payload before created_at is known. Every field keeps its precise
// generated shape (closed enums included) -- only top-level presence is
// relaxed.
//
// event_id carries the semantic event name here (unlike pact.files, where
// event_id is a dedup UUID and event_type carries the semantic name).
export type AuthPayload = Partial<PactAuth>;

// Human labels for the pact-auth event_id constants. Keyed on the schema's
// own closed event_id union (not a hand-copied string list) -- an upstream
// vocabulary change (event id added/renamed/removed in pact.auth.schema.json)
// fails typecheck here instead of silently falling back to the raw value in
// the UI. Falls back to the raw value at runtime for any payload whose
// event_id doesn't match this build's schema (e.g. a producer ahead of a
// pact-web deploy) -- never throws, never hides an unrecognised event.
export const AUTH_EVENT_LABELS: Record<PactAuth['event_id'], string> = {
  login_started: 'Login started',
  login_succeeded: 'Login succeeded',
  login_failed: 'Login failed',
  login_unverified: 'Login blocked (unverified)',
  register_succeeded: 'Registered',
  email_verification_requested: 'Verification email sent',
  email_verified: 'Email verified',
  password_set_link_requested: 'Password set link requested',
  password_reset_requested: 'Password reset requested',
  password_changed: 'Password changed',
};

export const decodeAuthPayload = (raw: string): AuthPayload | null => {
  try {
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null;

    return p as AuthPayload;
  } catch {
    return null;
  }
};

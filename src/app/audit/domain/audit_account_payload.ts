import { type PactAccount } from '@/src/__codegen__/schema/pact-account';

// Shape of the JSON pact-account's Kafka producer emits on topic
// pact.account, generated from pact-contracts'
// account/pact.account.schema.json (PACT-575) -- see
// src/__codegen__/schema/pact-account/. Matches pact-account
// internal/kafka/producer.go AccountEvent; decoded lazily.
//
// Partial<>, not the bare generated PactAccount: the wire schema marks
// event_id/created_at as required (always present on a real Kafka payload),
// but this type is also used to type payload *drafts* being built up
// incrementally by the mock seeder (mock/data/audit.ts). Every field keeps
// its precise generated shape (closed enums included) -- only top-level
// presence is relaxed. document/version/granted are only populated on
// consent_recorded.
export type AccountPayload = Partial<PactAccount>;

// Human labels for the pact-account event_id constants. Keyed on the
// schema's own closed event_id union (not a hand-copied string list) -- an
// upstream vocabulary change fails typecheck here instead of silently
// falling back to the raw value in the UI. Falls back to the raw value at
// runtime for any payload whose event_id doesn't match this build's schema
// -- never throws, never hides an unrecognised event.
export const ACCOUNT_EVENT_LABELS: Record<PactAccount['event_id'], string> = {
  user_erasure_requested: 'Erasure requested (GDPR)',
  consent_recorded: 'Consent recorded',
  profile_updated: 'Profile updated',
  preferences_updated: 'Preferences updated',
};

export const decodeAccountPayload = (raw: string): AccountPayload | null => {
  try {
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null || Array.isArray(p)) return null;

    return p as AccountPayload;
  } catch {
    return null;
  }
};

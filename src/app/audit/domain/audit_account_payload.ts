// Shape of the JSON pact-account's Kafka producer emits on topic
// pact.account. Matches pact-account internal/kafka/producer.go
// AccountEvent -- decoded lazily; unknown/missing fields are tolerated
// per the audit schema contract.
export interface AccountPayload {
  event_uuid?: string;
  event_id?: string;
  user_id?: string;
  request_id?: string;
  created_at?: string;
  // document/version/granted are only populated on consent_recorded.
  document?: string;
  version?: string;
  granted?: boolean;
}

export const ACCOUNT_EVENT_LABELS: Record<string, string> = {
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

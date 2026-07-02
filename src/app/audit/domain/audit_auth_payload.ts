// Shape of the JSON pact-auth's Kafka producer emits on topic pact.auth.
// Matches pact-auth internal/kafka/producer.go AuthEvent -- decoded lazily;
// unknown/missing fields are tolerated per the audit schema contract.
//
// event_id carries the semantic event name here (unlike pact.files, where
// event_id is a dedup UUID and event_type carries the semantic name).
export interface AuthPayload {
  event_uuid?: string;
  event_id?: string;
  user_id?: string;
  provider?: string;
  request_id?: string;
  created_at?: string;
  email?: string;
  return_to?: string;
  expires_at?: string;
  method?: string;
  ip?: string;
  display_name?: string;
  avatar_url?: string;
}

// Human labels for the pact-auth event_id constants. Falls back to the raw
// value for event ids the UI doesn't recognise yet -- never throws, never
// hides an unrecognised event.
export const AUTH_EVENT_LABELS: Record<string, string> = {
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

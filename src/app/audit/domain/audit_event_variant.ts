import {
  type AccountPayload,
  decodeAccountPayload,
} from '@/src/app/audit/domain/audit_account_payload';
import {
  type AuthPayload,
  decodeAuthPayload,
} from '@/src/app/audit/domain/audit_auth_payload';
import {
  type FilesPayload,
  decodeFilesPayload,
} from '@/src/app/audit/domain/audit_files_payload';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/lib/decisions/decision_payload';

// Discriminated union over every audit topic pact-web knows how to render.
// `unknown` is the fallback for a topic we don't have a decoder for yet
// (e.g. pact.policy, ahead of PACT-306/308) or a payload that failed to
// decode against the topic we expected -- decodeAuditEventVariant is total,
// it always returns a variant and never throws.
export type AuditEventVariant =
  | { kind: 'decisions'; payload: DecisionPayload }
  | { kind: 'auth'; payload: AuthPayload }
  | { kind: 'account'; payload: AccountPayload }
  | { kind: 'files'; payload: FilesPayload }
  | { kind: 'unknown'; raw: string };

// Single source of truth for every audit topic pact-web has a decoder for:
// the Kafka topic string (key), the decoder function, the AuditEventVariant
// discriminant it produces, and the human label AuditWorkbench's topic
// filter shows for it. Insertion order is display order -- AuditWorkbench
// derives its topic dropdown by iterating these entries in place (PACT-581),
// so reordering this object reorders the dropdown.
//
// pact.policy is deliberately absent: it's queryable server-side
// (PACT-306/308) but pact-web has no decoder for it yet, so it falls
// through decodeAuditEventVariant's registry lookup to the 'unknown'
// variant, same as any topic pact-web hasn't shipped a decoder for.
// AuditWorkbench lists it separately, for discoverability.
export const AUDIT_TOPIC_REGISTRY = {
  'pact.auth': {
    kind: 'auth',
    label: 'pact.auth (sign-in / passkey / MFA)',
    decode: decodeAuthPayload,
  },
  'pact.account': {
    kind: 'account',
    label: 'pact.account (profile / consents / GDPR)',
    decode: decodeAccountPayload,
  },
  'pact.files': {
    kind: 'files',
    label: 'pact.files (upload lifecycle)',
    decode: decodeFilesPayload,
  },
  'pact.decisions': {
    kind: 'decisions',
    label: 'pact.decisions (allow / block calls)',
    decode: parseDecisionPayload,
  },
} as const;

// Every Kafka topic with a registered decoder. Not exhaustive over every
// topic pact-audit can return -- see the registry's pact.policy note above.
export type AuditTopic = keyof typeof AUDIT_TOPIC_REGISTRY;

// Dropdown options for AuditWorkbench's topic filter, in display order:
// "All topics" (the real server-side "no topic filter" option -- see
// AuditWorkbench for the QueryEvents behavior that makes it valid), then
// every topic with a registered decoder in AUDIT_TOPIC_REGISTRY order, then
// pact.policy last for discoverability even though pact-audit doesn't
// consume that topic yet (PACT-306/308; selecting it always yields an
// honest empty result, never a crash). A domain constant (PACT-581) rather
// than hand-rolled in the UI, so the dropdown can never drift from the
// topics decodeAuditEventVariant actually knows how to render.
export const AUDIT_TOPIC_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All topics' },
  ...Object.entries(AUDIT_TOPIC_REGISTRY).map(([topic, { label }]) => ({
    value: topic,
    label,
  })),
  { value: 'pact.policy', label: 'pact.policy (not yet available)' },
];

// Pretty-print the JSONB payload string for the raw-payload panel every
// row shows when expanded. If the payload isn't valid JSON we fall back to
// the raw string -- a malformed row is itself diagnostic and shouldn't
// crash the viewer.
export const prettyPayload = (raw: string): string => {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw) as unknown;

    return JSON.stringify(parsed, null, 2);
  } catch {
    return raw;
  }
};

export const decodeAuditEventVariant = (
  topic: string,
  payloadJson: string
): AuditEventVariant => {
  if (!(topic in AUDIT_TOPIC_REGISTRY)) {
    // Covers pact.policy (not consumed yet, PACT-306/308) and any future
    // topic pact-web hasn't shipped a decoder for.
    return { kind: 'unknown', raw: payloadJson };
  }

  const entry = AUDIT_TOPIC_REGISTRY[topic as AuditTopic];
  const payload = entry.decode(payloadJson);

  // The cast is safe, not just convenient: AUDIT_TOPIC_REGISTRY's own literal
  // shape always pairs a `kind` with the payload type its sibling `decode`
  // produces -- TypeScript just can't see that correlation once `entry` is
  // looked up through a union-typed key instead of a literal one.
  return payload
    ? ({ kind: entry.kind, payload } as AuditEventVariant)
    : { kind: 'unknown', raw: payloadJson };
};

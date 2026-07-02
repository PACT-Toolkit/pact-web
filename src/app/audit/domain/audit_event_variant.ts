import {
  type AccountPayload,
  decodeAccountPayload,
} from '@/src/app/audit/domain/audit_account_payload';
import {
  type AuthPayload,
  decodeAuthPayload,
} from '@/src/app/audit/domain/audit_auth_payload';
import {
  type DecisionPayload,
  parseDecisionPayload,
} from '@/src/app/audit/domain/audit_decision_payload';
import {
  type FilesPayload,
  decodeFilesPayload,
} from '@/src/app/audit/domain/audit_files_payload';

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
  switch (topic) {
    case 'pact.decisions': {
      const payload = parseDecisionPayload(payloadJson);

      return payload
        ? { kind: 'decisions', payload }
        : { kind: 'unknown', raw: payloadJson };
    }
    case 'pact.auth': {
      const payload = decodeAuthPayload(payloadJson);

      return payload
        ? { kind: 'auth', payload }
        : { kind: 'unknown', raw: payloadJson };
    }
    case 'pact.account': {
      const payload = decodeAccountPayload(payloadJson);

      return payload
        ? { kind: 'account', payload }
        : { kind: 'unknown', raw: payloadJson };
    }
    case 'pact.files': {
      const payload = decodeFilesPayload(payloadJson);

      return payload
        ? { kind: 'files', payload }
        : { kind: 'unknown', raw: payloadJson };
    }
    default:
      // Covers pact.policy (not consumed yet, PACT-306/308) and any future
      // topic pact-web hasn't shipped a decoder for.
      return { kind: 'unknown', raw: payloadJson };
  }
};

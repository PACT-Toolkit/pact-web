import { type AuditAuditEventResponse } from '@/src/__codegen__/rest/audit';
import { type AuditEventVariant } from '@/src/app/audit/domain/audit_event_variant';
import { collectDecisionControls } from '@/src/framework/decisions/control_frameworks';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

// Actor/user filtering has no server-side query param -- pact-gateway's
// QueryAuditEventsParams only exposes topic/requestId/sinceUnix/untilUnix
// (see pact-audit internal/store/events.go buildWhere; user_id is always
// pinned to the session, never caller-supplied). We apply this filter
// client-side over the fetched page instead of inventing a backend param.
//
// Collects every actor-identifying string we can find on a row: the
// row-level userId (present on most topics) plus topic-specific identity
// fields (email on pact.auth) that help distinguish rows when userId is
// absent (system-initiated events) or opaque.
const actorCandidates = (
  event: AuditAuditEventResponse,
  variant: AuditEventVariant
): string[] => {
  const out: string[] = [];
  if (event.userId) out.push(event.userId);

  if (variant.kind === 'auth') {
    if (variant.payload.user_id) out.push(variant.payload.user_id);
    if (variant.payload.email) out.push(variant.payload.email);
    if (variant.payload.display_name) out.push(variant.payload.display_name);
  } else if (variant.kind === 'account' && variant.payload.user_id) {
    out.push(variant.payload.user_id);
  } else if (variant.kind === 'files' && variant.payload.user_id) {
    out.push(variant.payload.user_id);
  } else if (variant.kind === 'decisions' && variant.payload.session_id) {
    out.push(variant.payload.session_id);
  }

  return out;
};

// Case-insensitive substring match against every actor candidate on the
// row. An empty query always matches (filter is a no-op).
export const matchesActorFilter = (
  event: AuditAuditEventResponse,
  variant: AuditEventVariant,
  query: string
): boolean => {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return actorCandidates(event, variant).some((candidate) =>
    candidate.toLowerCase().includes(q)
  );
};

// Converts an <input type="datetime-local"> value (local time, no
// timezone) to unix seconds for the sinceUnix/untilUnix query params.
// Returns undefined for an empty or unparsable value so callers can spread
// it straight into the params object without an extra guard.
export const localDateTimeToUnixSeconds = (
  value: string
): number | undefined => {
  if (!value) return undefined;
  const ms = new Date(value).getTime();

  return Number.isNaN(ms) ? undefined : Math.floor(ms / 1000);
};

// The gateway only filters on a control when BOTH halves are given (it
// answers 400 "controlFramework and controlId must be set together"
// otherwise), so a half-set pair sends neither param. Returns undefined for
// both-empty and half-set so callers can spread the result into the params
// object without an extra guard.
export const controlFilterParams = (
  framework: string,
  id: string
): { controlFramework: string; controlId: string } | undefined => {
  const controlId = id.trim();

  return framework && controlId
    ? { controlFramework: framework, controlId }
    : undefined;
};

// Mirrors the gateway's control filter for the MSW handler: true when any
// stage sub-object of the payload carries the framework+id control.
export const matchesControlFilter = (
  payload: DecisionPayload,
  framework: string,
  id: string
): boolean =>
  collectDecisionControls(payload).some(
    (control) => control.framework === framework && control.id === id
  );

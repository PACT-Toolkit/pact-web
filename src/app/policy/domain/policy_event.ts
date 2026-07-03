// Domain types for the policy decisions feed (GET /v1/audit/policy-events).
// Distinct from policy_rule.ts, which models the authored rules themselves;
// these model evaluated capability-token decisions.
//
// Wire types are generated from pact-gateway's audit per-tag slice
// (schema/audit, hand-maintained since pact-audit is gRPC-only -- see
// schema/audit/swagger.yaml's header comment). Alias the codegen names to
// the domain vocabulary so the rest of the feature imports stable event
// types from the domain layer rather than the __codegen__ folder.
import {
  type PolicyEvent as AuditPolicyEvent,
  type QueryPolicyEventsResponse,
} from '@/src/__codegen__/rest/audit';

export type PolicyEvent = AuditPolicyEvent;
export type PolicyEventsResponse = QueryPolicyEventsResponse;

// isPolicyEventDenied reports whether a policy event's overall pipeline
// decision was a block. The generated type is a free-form string (the
// gateway serialises Go's Decision as `type: string`), so this is a
// client-side refinement used for display styling only, same as
// policy_rule.ts's RuleStatus union over PolicyRule.status.
export const isPolicyEventDenied = (event: PolicyEvent): boolean =>
  event.decision === 'block';

// policyEventVerdict prefers the nested policy.verdict (allowed/denied,
// populated by the policy service) and falls back to the top-level
// decision when policy is absent -- the generated PolicyEvent.policy field
// is optional even though pact-gateway always populates it as a
// non-pointer struct, so this stays correct if that ever changes.
export const policyEventVerdict = (event: PolicyEvent): string =>
  event.policy?.verdict ?? (isPolicyEventDenied(event) ? 'denied' : 'allowed');

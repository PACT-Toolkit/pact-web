// Domain types for the rule-authoring surface (GET/POST /v1/rules via the
// gateway). Distinct from policy_event.ts, which models evaluated capability-
// token decisions; these model the authored rules themselves.
//
// Wire types are generated from the gateway's per-tag swagger slice
// (schema/rules, pulled from pact-gateway). Alias the codegen names to the
// domain vocabulary so the rest of the feature imports stable rule types from
// the domain layer rather than the __codegen__ folder.
import {
  type RulesCreateRuleRequest,
  type RulesRuleResponse,
} from '@/src/__codegen__/rest/rules';

export type PolicyRule = RulesRuleResponse;
export type CreateRuleInput = RulesCreateRuleRequest;

// RuleStatus is the closed set of statuses pact-policy assigns. The gateway
// serialises it as a free-form string (RulesRuleResponse.status: string), so
// this union is a client-side refinement used for display styling only.
export type RuleStatus =
  | 'draft'
  | 'reviewed'
  | 'published'
  | 'revoked'
  | 'unspecified';

// RuleActionErrorCode classifies a failed publish/revoke so the UI can map it
// to an actionable message. `illegal_transition` is the gateway's 400 (the
// rule's status changed under us), `not_found` is its 404 (the rule no longer
// exists), and `unknown` covers auth/transport/5xx failures.
export type RuleActionErrorCode =
  | 'illegal_transition'
  | 'not_found'
  | 'unknown';

// RuleActionError is thrown by the publish/revoke flows so callers can branch
// on `code` rather than parsing a message string.
export class RuleActionError extends Error {
  readonly code: RuleActionErrorCode;

  constructor(code: RuleActionErrorCode, message: string) {
    super(message);
    this.name = 'RuleActionError';
    this.code = code;
  }
}

// ruleActionErrorCodeForStatus maps a gateway HTTP status onto the closed set
// of action error codes.
export function ruleActionErrorCodeForStatus(
  status: number
): RuleActionErrorCode {
  if (status === 400) return 'illegal_transition';
  if (status === 404) return 'not_found';

  return 'unknown';
}

// parseScopes turns a free-form comma-separated string into a deduped,
// trimmed scope list. Empty segments are dropped so "read, , write," yields
// ["read", "write"].
export function parseScopes(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ];
}

// sortRulesNewestFirst returns a copy ordered by createdAt descending. The
// gateway already applies this ordering, but sorting client-side keeps the
// list stable if an optimistically-added rule arrives out of order.
export function sortRulesNewestFirst(rules: PolicyRule[]): PolicyRule[] {
  return [...rules].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

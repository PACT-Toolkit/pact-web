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
  type RulesListRulesResponse,
  type RulesRuleResponse,
} from '@/src/__codegen__/rest/rules';

export type PolicyRule = RulesRuleResponse;
export type ListRulesResponse = RulesListRulesResponse;
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

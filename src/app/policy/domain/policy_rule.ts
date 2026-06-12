// Domain types for the rule-authoring surface (GET/POST /v1/rules via the
// gateway). Distinct from policy_event.ts, which models evaluated capability-
// token decisions; these model the authored rules themselves.

export type RuleStatus =
  | 'draft'
  | 'reviewed'
  | 'published'
  | 'revoked'
  | 'unspecified';

export interface PolicyRule {
  id: string;
  name: string;
  status: RuleStatus;
  version: number;
  createdAt: string; // RFC 3339
  updatedAt: string; // RFC 3339
}

export interface ListRulesResponse {
  rules: PolicyRule[];
}

export interface CreateRuleInput {
  name: string;
  packYaml: string;
  scopes: string[];
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

import { useMemo } from 'react';
import useSWR from 'swr';

import { getListRulesKey, listRules } from '@/src/__codegen__/rest/rules';
import {
  type PolicyRule,
  sortRulesNewestFirst,
} from '@/src/app/policy/domain/policy_rule';

// usePolicyRules is the read side of rule authoring: the SWR-backed rule
// list, its loading/validating/error state, and a manual revalidate.
// Writes (create/publish/revoke) live in usePolicyRuleActions
// (use_policy_rule_actions.ts) -- both hooks share the same SWR cache entry
// via getListRulesKey(), so an action's cache patch is visible here without
// either hook holding a reference to the other.
export function usePolicyRules() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    getListRulesKey(),
    () => listRules(),
    { revalidateOnFocus: false }
  );

  const rules = useMemo<PolicyRule[]>(
    () => (data?.status === 200 ? sortRulesNewestFirst(data.data.rules) : []),
    [data]
  );

  // The generated fetcher resolves its promise for every HTTP status, so a
  // non-200 (401/5xx) would otherwise read as "no rules" rather than a
  // failure. Surface it so the editor can show its error state.
  const httpError =
    data && data.status !== 200
      ? new Error(`rules request failed (${data.status})`)
      : undefined;

  return {
    rules,
    isLoading,
    isValidating,
    error: error ?? httpError,
    refresh: mutate,
  };
}

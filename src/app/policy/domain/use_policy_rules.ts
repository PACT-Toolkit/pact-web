import { useMemo } from 'react';
import useSWR from 'swr';

import {
  createRule,
  getListRulesKey,
  listRules,
} from '@/src/__codegen__/rest/rules';
import {
  type CreateRuleInput,
  type PolicyRule,
  sortRulesNewestFirst,
} from '@/src/app/policy/domain/policy_rule';

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

  const createPolicyRule = async (
    input: CreateRuleInput
  ): Promise<PolicyRule> => {
    const res = await createRule(input);
    if (res.status !== 201) {
      throw new Error(`create rule failed (${res.status})`);
    }
    await mutate();

    return res.data;
  };

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
    createRule: createPolicyRule,
    refresh: mutate,
  };
}

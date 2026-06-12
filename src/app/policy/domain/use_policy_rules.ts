import { useMemo } from 'react';
import useSWR from 'swr';

import {
  type CreateRuleInput,
  type ListRulesResponse,
  type PolicyRule,
  sortRulesNewestFirst,
} from '@/src/app/policy/domain/policy_rule';
import { httpClient } from '@/src/framework/http';

// Gateway-native resource, proxied by app/api/pact/gateway/v1/rules/route.ts
// in real mode and intercepted by MSW in mock mode.
const RULES_URL = '/api/pact/gateway/v1/rules';

const fetchRules = (url: string) =>
  httpClient.get<ListRulesResponse>(url).then((r) => r.data);

export function usePolicyRules() {
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<ListRulesResponse>(RULES_URL, fetchRules, {
      revalidateOnFocus: false,
    });

  const createRule = async (input: CreateRuleInput): Promise<PolicyRule> => {
    const res = await httpClient.post<PolicyRule>(RULES_URL, {
      name: input.name,
      packYaml: input.packYaml,
      scopes: input.scopes,
    });
    await mutate();

    return res.data;
  };

  return {
    rules: useMemo(() => sortRulesNewestFirst(data?.rules ?? []), [data]),
    isLoading,
    isValidating,
    error,
    createRule,
    refresh: mutate,
  };
}

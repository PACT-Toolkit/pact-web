import { useMemo } from 'react';
import useSWR from 'swr';

import {
  createRule,
  getListRulesKey,
  listRules,
  publishRule,
  revokeRule,
  type listRulesResponse,
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

  // Patches the list optimistically: replaces the matching rule's status with
  // the expected next status while the API call is in flight, then populates
  // the cache with the server-confirmed rule on success or rolls back on error.
  const patchRuleOptimistically = async (
    ruleId: string,
    optimisticStatus: string,
    apiCall: () => Promise<PolicyRule>
  ): Promise<PolicyRule> => {
    let confirmed: PolicyRule | undefined;

    await mutate(
      async (current) => {
        const updated = await apiCall();
        confirmed = updated;
        if (!current || current.status !== 200) return current;

        return {
          ...current,
          data: {
            rules: current.data.rules.map((r) =>
              r.id === ruleId ? updated : r
            ),
          },
        } as listRulesResponse;
      },
      {
        optimisticData: (current): listRulesResponse => {
          // When the user triggers an action the list is already loaded, so
          // current is a 200 response in practice. The non-200 / undefined
          // branches fall back gracefully to avoid mutating stale/error state.
          if (!current || current.status !== 200) {
            return (current ?? {
              status: 200 as const,
              data: { rules: [] },
              headers: new Headers(),
            }) as listRulesResponse;
          }

          return {
            ...current,
            data: {
              rules: current.data.rules.map((r) =>
                r.id === ruleId ? { ...r, status: optimisticStatus } : r
              ),
            },
          };
        },
        rollbackOnError: true,
        populateCache: true,
        revalidate: false,
      }
    );

    if (!confirmed) throw new Error('rule action: no response data');

    return confirmed;
  };

  const publishPolicyRule = (ruleId: string): Promise<PolicyRule> =>
    patchRuleOptimistically(ruleId, 'published', async () => {
      const res = await publishRule(ruleId);
      if (res.status !== 200) {
        throw new Error(`publish rule failed (${res.status})`);
      }

      return res.data;
    });

  const revokePolicyRule = (ruleId: string): Promise<PolicyRule> =>
    patchRuleOptimistically(ruleId, 'revoked', async () => {
      const res = await revokeRule(ruleId);
      if (res.status !== 200) {
        throw new Error(`revoke rule failed (${res.status})`);
      }

      return res.data;
    });

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
    publishRule: publishPolicyRule,
    revokeRule: revokePolicyRule,
    refresh: mutate,
  };
}

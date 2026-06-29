import { useMemo } from 'react';
import useSWR, { useSWRConfig } from 'swr';

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
  RuleActionError,
  ruleActionErrorCodeForStatus,
  sortRulesNewestFirst,
} from '@/src/app/policy/domain/policy_rule';

// replaceRuleInCache returns a copy of the cached list response with the rule
// matching `updated.id` swapped for `updated`. It reads from whatever cache it
// is handed, so passing the FRESHEST cache (SWR's populateCache currentData
// arg) keeps concurrent in-flight actions on other rules intact.
const replaceRuleInCache = (
  current: listRulesResponse | undefined,
  updated: PolicyRule
): listRulesResponse => {
  // No loaded list to merge into (not reachable once the action buttons have
  // rendered). Seed a 200 response holding just the confirmed rule.
  if (!current || current.status !== 200) {
    return {
      status: 200 as const,
      data: { rules: [updated] },
      headers: current?.headers ?? new Headers(),
    } as listRulesResponse;
  }

  return {
    ...current,
    data: {
      rules: current.data.rules.map((r) => (r.id === updated.id ? updated : r)),
    },
  };
};

// patchRuleStatusInCache returns a copy of the cached list response with only
// the targeted rule's status flipped. Used for the optimistic snapshot so the
// badge updates instantly without touching any other row.
const patchRuleStatusInCache = (
  current: listRulesResponse | undefined,
  ruleId: string,
  status: string
): listRulesResponse => {
  // The action buttons only render once the list has loaded, so a non-200 /
  // undefined cache is not reachable in practice. Fall back to an empty list
  // response to satisfy SWR's "optimisticData must return Data" contract.
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
        r.id === ruleId ? { ...r, status } : r
      ),
    },
  };
};

export function usePolicyRules() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    getListRulesKey(),
    () => listRules(),
    { revalidateOnFocus: false }
  );
  // The bound mutate's data argument is constrained to the list-response shape,
  // so the per-rule optimistic write (which resolves to a single rule) goes
  // through the scoped mutator instead. Both target getListRulesKey(), so they
  // share the same cache entry as the useSWR read above.
  const { mutate: globalMutate } = useSWRConfig();

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

  // Patches the cached list through synchronous functional mutate updaters so
  // concurrent actions on different rules coexist. Each updater reads the
  // FRESHEST cache and maps only its own rule id, so a publish on rule A never
  // clobbers an in-flight revoke on rule B.
  //
  // We deliberately avoid SWR's awaited-promise optimisticData here: when two
  // optimistic mutations target the same key, SWR supersedes the
  // earlier-started one and rolls back its optimistic data, which would drop
  // one of two concurrent transitions. A synchronous updater commits
  // immediately and is not subject to that race.
  const patchListRule = (
    updater: (current: listRulesResponse | undefined) => listRulesResponse
  ): Promise<unknown> =>
    globalMutate<listRulesResponse>(getListRulesKey(), updater, {
      revalidate: false,
      populateCache: true,
    });

  const patchRuleOptimistically = async (
    ruleId: string,
    optimisticStatus: string,
    apiCall: () => Promise<PolicyRule>
  ): Promise<PolicyRule> => {
    // Flip only the targeted rule's status immediately, recording its prior
    // status (read from the freshest cache) so we can roll back on failure.
    let priorStatus: string | undefined;
    await patchListRule((current) => {
      if (current?.status === 200) {
        priorStatus = current.data.rules.find((r) => r.id === ruleId)?.status;
      }

      return patchRuleStatusInCache(current, ruleId, optimisticStatus);
    });

    try {
      const updated = await apiCall();
      // Merge the server-confirmed rule into whatever the cache holds now.
      await patchListRule((current) => replaceRuleInCache(current, updated));

      return updated;
    } catch (err) {
      // Undo just this rule's optimistic flip; other rows are untouched.
      if (priorStatus !== undefined) {
        const rollbackStatus = priorStatus;
        await patchListRule((current) =>
          patchRuleStatusInCache(current, ruleId, rollbackStatus)
        );
      }

      throw err;
    }
  };

  // Runs a publish/revoke and, on a transition (400) or missing-rule (404)
  // failure, revalidates the list so the row reflects server truth rather than
  // the optimistic snapshot that was just rolled back.
  const runRuleAction = async (
    ruleId: string,
    optimisticStatus: string,
    apiCall: () => Promise<PolicyRule>
  ): Promise<PolicyRule> => {
    try {
      return await patchRuleOptimistically(ruleId, optimisticStatus, apiCall);
    } catch (err) {
      if (
        err instanceof RuleActionError &&
        (err.code === 'illegal_transition' || err.code === 'not_found')
      ) {
        void mutate();
      }

      throw err;
    }
  };

  const publishPolicyRule = (ruleId: string): Promise<PolicyRule> =>
    runRuleAction(ruleId, 'published', async () => {
      const res = await publishRule(ruleId);
      if (res.status !== 200) {
        throw new RuleActionError(
          ruleActionErrorCodeForStatus(res.status),
          `publish rule failed (${res.status})`
        );
      }

      return res.data;
    });

  const revokePolicyRule = (ruleId: string): Promise<PolicyRule> =>
    runRuleAction(ruleId, 'revoked', async () => {
      const res = await revokeRule(ruleId);
      if (res.status !== 200) {
        throw new RuleActionError(
          ruleActionErrorCodeForStatus(res.status),
          `revoke rule failed (${res.status})`
        );
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

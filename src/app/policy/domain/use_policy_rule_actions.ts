import { useSWRConfig } from 'swr';

import {
  createRule,
  getListRulesKey,
  publishRule,
  revokeRule,
  type listRulesResponse,
} from '@/src/__codegen__/rest/rules';
import {
  type CreateRuleInput,
  type PolicyRule,
  RuleActionError,
  ruleActionErrorCodeForStatus,
} from '@/src/app/policy/domain/policy_rule';

// replaceRuleInCache returns a copy of the cached list response with the rule
// matching `updated.id` swapped for `updated`. It reads from whatever cache it
// is handed, so passing the FRESHEST cache keeps concurrent in-flight actions
// on other rules intact. When there is no loaded 200 list (the cache is still
// undefined or holds an error), it returns `current` unchanged so an action
// firing pre-load can never replace a real cache with a fabricated one.
const replaceRuleInCache = (
  current: listRulesResponse | undefined,
  updated: PolicyRule
): listRulesResponse | undefined => {
  if (!current || current.status !== 200) return current;

  return {
    ...current,
    data: {
      rules: current.data.rules.map((r) => (r.id === updated.id ? updated : r)),
    },
  };
};

// patchRuleStatusInCache returns a copy of the cached list response with only
// the targeted rule's status flipped, used for the optimistic badge update.
// Like replaceRuleInCache, it is a no-op (returns `current` unchanged) when
// there is no loaded 200 list, so it never blanks the visible list.
const patchRuleStatusInCache = (
  current: listRulesResponse | undefined,
  ruleId: string,
  status: string
): listRulesResponse | undefined => {
  if (!current || current.status !== 200) return current;

  return {
    ...current,
    data: {
      rules: current.data.rules.map((r) =>
        r.id === ruleId ? { ...r, status } : r
      ),
    },
  };
};

// usePolicyRuleActions is the write side of rule authoring: create, and the
// optimistic publish/revoke machinery. It shares the SWR cache entry with
// usePolicyRules (use_policy_rules.ts) via getListRulesKey(), patching and
// revalidating it through useSWRConfig()'s global mutate rather than a local
// useSWR call, so any usePolicyRules reader on the page reflects the change
// without either hook needing a reference to the other's instance.
export function usePolicyRuleActions() {
  const { mutate: globalMutate } = useSWRConfig();

  const createPolicyRule = async (
    input: CreateRuleInput
  ): Promise<PolicyRule> => {
    const res = await createRule(input);
    if (res.status !== 201) {
      throw new Error(`create rule failed (${res.status})`);
    }
    await globalMutate(getListRulesKey());

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
    updater: (
      current: listRulesResponse | undefined
    ) => listRulesResponse | undefined
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
        void globalMutate(getListRulesKey());
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

  return {
    createRule: createPolicyRule,
    publishRule: publishPolicyRule,
    revokeRule: revokePolicyRule,
  };
}

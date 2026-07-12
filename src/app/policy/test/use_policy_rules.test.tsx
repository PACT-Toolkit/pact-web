import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import {
  type PolicyRule,
  RuleActionError,
} from '@/src/app/policy/domain/policy_rule';
import { usePolicyRules } from '@/src/app/policy/domain/use_policy_rules';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const BASE = `http://localhost${MSW_PACT_BASE.replace('*', '')}/gateway/v1/rules`;

// Fresh SWR cache per render so optimistic writes from one test never bleed
// into the next. Both useSWR and the hook's useSWRConfig().mutate resolve to
// this provider, so they share the same cache entry.
const createWrapper = () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );

  return Wrapper;
};

// Seed a draft rule through the real create handler so each test owns a rule
// with a known id (the shared in-memory store also holds rules from other
// tests, so we always filter by id).
const seedRule = async (name: string): Promise<PolicyRule> => {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, packYaml: 'pack: v1\nrules: []' }),
  });

  return res.json() as Promise<PolicyRule>;
};

// A promise the test resolves by hand, used to hold a handler open so we can
// observe state between "request sent" and "request resolved".
const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
};

const findRule = (rules: PolicyRule[], id: string): PolicyRule | undefined =>
  rules.find((r) => r.id === id);

describe('usePolicyRules publish/revoke', () => {
  it('flips the row status optimistically before the request resolves', async () => {
    const seeded = await seedRule('hook-optimistic-publish');
    const gate = deferred<void>();

    server.use(
      http.post(
        `${MSW_PACT_BASE}/gateway/v1/rules/${seeded.id}/publish`,
        async () => {
          await gate.promise;

          return HttpResponse.json({
            ...seeded,
            status: 'published',
            version: 2,
          });
        }
      )
    );

    const { result } = renderHook(() => usePolicyRules(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(findRule(result.current.rules, seeded.id)?.status).toBe('draft')
    );

    let action!: Promise<PolicyRule>;
    act(() => {
      action = result.current.publishRule(seeded.id);
    });

    // The badge flips while the handler is still gated (request not resolved),
    // and the server-only fields (version) are untouched until it does.
    await waitFor(() => {
      const rule = findRule(result.current.rules, seeded.id);
      expect(rule?.status).toBe('published');
      expect(rule?.version).toBe(1);
    });

    gate.resolve();
    await act(async () => {
      await action;
    });

    // After the request resolves, the confirmed rule (version 2) is merged in.
    const confirmed = findRule(result.current.rules, seeded.id);
    expect(confirmed?.status).toBe('published');
    expect(confirmed?.version).toBe(2);
  });

  it('rolls back the optimistic status when publish returns 400', async () => {
    const seeded = await seedRule('hook-rollback-400');

    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/rules/${seeded.id}/publish`, () =>
        HttpResponse.json({ error: 'illegal transition' }, { status: 400 })
      )
    );

    const { result } = renderHook(() => usePolicyRules(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(findRule(result.current.rules, seeded.id)?.status).toBe('draft')
    );

    await act(async () => {
      await expect(result.current.publishRule(seeded.id)).rejects.toMatchObject(
        {
          code: 'illegal_transition',
        }
      );
    });

    // Rolled back to the pre-optimistic status, then revalidated to server truth.
    await waitFor(() =>
      expect(findRule(result.current.rules, seeded.id)?.status).toBe('draft')
    );
  });

  it('rolls back the optimistic status when revoke returns 404', async () => {
    const seeded = await seedRule('hook-rollback-404');
    await fetch(`${BASE}/${seeded.id}/publish`, { method: 'POST' });

    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/rules/${seeded.id}/revoke`, () =>
        HttpResponse.json({ error: 'not found' }, { status: 404 })
      )
    );

    const { result } = renderHook(() => usePolicyRules(), {
      wrapper: createWrapper(),
    });

    await waitFor(() =>
      expect(findRule(result.current.rules, seeded.id)?.status).toBe(
        'published'
      )
    );

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.revokeRule(seeded.id);
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBeInstanceOf(RuleActionError);
    expect((caught as RuleActionError).code).toBe('not_found');

    // The optimistic revoke is undone; the row stays published (server truth).
    await waitFor(() =>
      expect(findRule(result.current.rules, seeded.id)?.status).toBe(
        'published'
      )
    );
  });

  it('keeps both transitions when publish(A) and revoke(B) run concurrently', async () => {
    const ruleA = await seedRule('hook-concurrent-A');
    const ruleB = await seedRule('hook-concurrent-B');
    // B must be published before it can be revoked.
    await fetch(`${BASE}/${ruleB.id}/publish`, { method: 'POST' });

    const { result } = renderHook(() => usePolicyRules(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(findRule(result.current.rules, ruleA.id)?.status).toBe('draft');
      expect(findRule(result.current.rules, ruleB.id)?.status).toBe(
        'published'
      );
    });

    await act(async () => {
      await Promise.all([
        result.current.publishRule(ruleA.id),
        result.current.revokeRule(ruleB.id),
      ]);
    });

    // Regression for the concurrent-action clobber: neither merge overwrites
    // the other, so both transitions survive in the same cache entry.
    expect(findRule(result.current.rules, ruleA.id)?.status).toBe('published');
    expect(findRule(result.current.rules, ruleB.id)?.status).toBe('revoked');
  });
});

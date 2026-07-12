import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { handlers } from '@/src/app/policy/mock/handlers/policy';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// Spin up a local MSW server wired to the policy mock handlers.
const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const BASE = `http://localhost${MSW_PACT_BASE.replace('*', '')}/gateway/v1/rules`;

// Helper: seed a rule with a known id via the create endpoint so publish/revoke
// tests have a real rule to act on (avoids relying on the pre-seeded UUIDs).
const seedRule = async (name: string): Promise<{ id: string }> => {
  const res = await fetch(`${BASE}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, packYaml: 'pack: v1\nrules: []' }),
  });

  return res.json() as Promise<{ id: string }>;
};

describe('mock handler: publish rule', () => {
  it('transitions draft -> published and returns the updated rule', async () => {
    const { id } = await seedRule('publish-test');

    const res = await fetch(`${BASE}/${id}/publish`, { method: 'POST' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id, status: 'published' });
  });

  it('returns 404 for an unknown rule id', async () => {
    const res = await fetch(`${BASE}/does-not-exist/publish`, {
      method: 'POST',
    });

    expect(res.status).toBe(404);
  });

  it('returns 400 when the rule is not in draft status', async () => {
    const { id } = await seedRule('already-published');

    // First publish succeeds.
    await fetch(`${BASE}/${id}/publish`, { method: 'POST' });

    // Second publish should fail: published -> published is not a valid transition.
    const res = await fetch(`${BASE}/${id}/publish`, { method: 'POST' });

    expect(res.status).toBe(400);
  });
});

describe('mock handler: revoke rule', () => {
  it('transitions published -> revoked and returns the updated rule', async () => {
    const { id } = await seedRule('revoke-test');

    await fetch(`${BASE}/${id}/publish`, { method: 'POST' });
    const res = await fetch(`${BASE}/${id}/revoke`, { method: 'POST' });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ id, status: 'revoked' });
  });

  it('returns 404 for an unknown rule id', async () => {
    const res = await fetch(`${BASE}/does-not-exist/revoke`, {
      method: 'POST',
    });

    expect(res.status).toBe(404);
  });

  it('returns 400 when the rule is not in published status', async () => {
    const { id } = await seedRule('not-published-yet');

    // Draft cannot be revoked directly.
    const res = await fetch(`${BASE}/${id}/revoke`, { method: 'POST' });

    expect(res.status).toBe(400);
  });
});

describe('mock handler: list rules reflects status transitions', () => {
  it('updated status is visible in subsequent list calls', async () => {
    const { id } = await seedRule('list-status-check');

    await fetch(`${BASE}/${id}/publish`, { method: 'POST' });

    const listRes = await fetch(BASE);
    const { rules } = (await listRes.json()) as {
      rules: { id: string; status: string }[];
    };
    const rule = rules.find((r) => r.id === id);

    expect(rule?.status).toBe('published');
  });
});

// Patch a handler to simulate a network error on publish, then verify the
// client can still render (no crash from MSW_PACT_BASE glob mismatch).
describe('mock handler URL pattern', () => {
  it('publish handler uses a glob pattern compatible with msw/node', async () => {
    // If the handler used a leading-slash path, this request would be
    // unhandled (server.listen has onUnhandledRequest: error) and throw.
    const { id } = await seedRule('pattern-check');
    const res = await fetch(`${BASE}/${id}/publish`, { method: 'POST' });

    expect(res.status).toBeLessThan(500);
  });
});

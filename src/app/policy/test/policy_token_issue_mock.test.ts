import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { issueToken } from '@/src/__codegen__/rest/policy';
import { handlers } from '@/src/app/policy/mock/handlers/policy';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// Spin up a local MSW server wired to the policy mock handlers, same
// pattern as policy_rule_actions.test.ts.
const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const BASE = `http://localhost${MSW_PACT_BASE.replace('*', '')}/gateway/v1/policy/tokens`;

const issue = (body: Record<string, unknown>) =>
  fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('mock handler: issue token', () => {
  it('mints a token for a valid request', async () => {
    const res = await issue({
      agentId: 'agent-alpha',
      toolId: 'tool-search',
      scopes: ['read'],
      ttlSeconds: 3600,
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { token: string; expiresAtUnix: number };
    expect(typeof body.token).toBe('string');
    expect(body.token.length).toBeGreaterThan(0);
    expect(body.expiresAtUnix).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('400s when agentId is missing', async () => {
    const res = await issue({
      toolId: 'tool-search',
      scopes: ['read'],
      ttlSeconds: 60,
    });
    expect(res.status).toBe(400);
  });

  it('400s when toolId is missing', async () => {
    const res = await issue({
      agentId: 'agent-alpha',
      scopes: ['read'],
      ttlSeconds: 60,
    });
    expect(res.status).toBe(400);
  });

  it('400s when scopes is empty', async () => {
    const res = await issue({
      agentId: 'agent-alpha',
      toolId: 'tool-search',
      scopes: [],
      ttlSeconds: 60,
    });
    expect(res.status).toBe(400);
  });

  it('400s when ttlSeconds is out of the 1..86400 bound', async () => {
    const tooLow = await issue({
      agentId: 'agent-alpha',
      toolId: 'tool-search',
      scopes: ['read'],
      ttlSeconds: 0,
    });
    expect(tooLow.status).toBe(400);

    const tooHigh = await issue({
      agentId: 'agent-alpha',
      toolId: 'tool-search',
      scopes: ['read'],
      ttlSeconds: 86_401,
    });
    expect(tooHigh.status).toBe(400);
  });

  // Regression test for a bug the Wrap-up pass caught: the generated
  // issueToken fetcher always JSON.parses the response body regardless of
  // status (src/__codegen__/rest/policy/fetchers.ts), so a 400 response
  // must be returned via HttpResponse.json, not HttpResponse.text -- a
  // .text body isn't valid JSON and would throw a SyntaxError here instead
  // of resolving to a normal error response.
  it('resolves (does not throw) when the generated fetcher parses a 400 body', async () => {
    const res = await issueToken({
      agentId: '',
      toolId: 'tool-search',
      scopes: ['read'],
      ttlSeconds: 60,
    });

    expect(res.status).toBe(400);
    expect(typeof res.data).toBe('string');
  });
});

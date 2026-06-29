import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { type PolicyEvent } from '@/src/app/policy/domain/policy_event';
import { type PolicyRule } from '@/src/app/policy/domain/policy_rule';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const min = 60_000;
const hour = 60 * min;

const policyEvents: PolicyEvent[] = [
  {
    id: uuidv4(),
    requestId: 'req-pol-001',
    createdAt: new Date(Date.now() - 3 * min).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: {
      verdict: 'allowed',
      agentId: 'agent-alpha',
      toolId: 'tool-search',
    },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-002',
    createdAt: new Date(Date.now() - 10 * min).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: { verdict: 'denied', agentId: 'agent-alpha', toolId: 'tool-exec' },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-003',
    createdAt: new Date(Date.now() - 22 * min).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: { verdict: 'allowed', agentId: 'agent-beta', toolId: 'tool-read' },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-004',
    createdAt: new Date(Date.now() - 45 * min).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: {
      verdict: 'denied',
      agentId: 'agent-gamma',
      toolId: 'tool-delete',
    },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-005',
    createdAt: new Date(Date.now() - hour).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: {
      verdict: 'allowed',
      agentId: 'agent-beta',
      toolId: 'tool-search',
    },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-006',
    createdAt: new Date(Date.now() - 2 * hour).toISOString(),
    decision: 'block',
    reason: 'policy_token_denied',
    policy: { verdict: 'denied', agentId: 'agent-alpha', toolId: 'tool-exec' },
  },
  {
    id: uuidv4(),
    requestId: 'req-pol-007',
    createdAt: new Date(Date.now() - 3 * hour).toISOString(),
    decision: 'allow',
    reason: 'policy_token_allowed',
    policy: { verdict: 'allowed', agentId: 'agent-gamma', toolId: 'tool-read' },
  },
];

// In-memory rule store backing the /v1/rules editor stub. Seeded with a couple
// of rules so the list renders non-empty on first load in mock mode.
const now = Date.now();
const policyRules: PolicyRule[] = [
  {
    id: uuidv4(),
    name: 'block-credential-exfil',
    status: 'published',
    version: 2,
    createdAt: new Date(now - 2 * hour).toISOString(),
    updatedAt: new Date(now - 30 * min).toISOString(),
  },
  {
    id: uuidv4(),
    name: 'flag-pii-in-prompts',
    status: 'draft',
    version: 1,
    createdAt: new Date(now - 6 * hour).toISOString(),
    updatedAt: new Date(now - 6 * hour).toISOString(),
  },
];

interface CreateRuleBody {
  name?: string;
  packYaml?: string;
  scopes?: string[];
}

// Valid publish/revoke transitions enforced by the mock.
const PUBLISH_TRANSITIONS: Record<string, string> = { draft: 'published' };
const REVOKE_TRANSITIONS: Record<string, string> = { published: 'revoked' };

export const handlers: RequestHandler[] = [
  http.get('*/v1/audit/policy-events', () =>
    HttpResponse.json({ events: policyEvents, total: policyEvents.length })
  ),

  http.get(`${MSW_PACT_BASE}/gateway/v1/rules`, () =>
    HttpResponse.json({
      rules: [...policyRules].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      ),
    })
  ),

  http.post(`${MSW_PACT_BASE}/gateway/v1/rules`, async ({ request }) => {
    const body = (await request.json()) as CreateRuleBody;
    if (!body.name || !body.packYaml) {
      return HttpResponse.json(
        { error: 'name and packYaml are required' },
        { status: 400 }
      );
    }
    const ts = new Date().toISOString();
    const rule: PolicyRule = {
      id: uuidv4(),
      name: body.name,
      status: 'draft',
      version: 1,
      createdAt: ts,
      updatedAt: ts,
    };
    policyRules.push(rule);

    return HttpResponse.json(rule, { status: 201 });
  }),

  http.post(`${MSW_PACT_BASE}/gateway/v1/rules/:id/publish`, ({ params }) => {
    const rule = policyRules.find((r) => r.id === params.id);
    if (!rule) {
      return HttpResponse.json({ error: 'rule not found' }, { status: 404 });
    }
    const nextStatus = PUBLISH_TRANSITIONS[rule.status];
    if (!nextStatus) {
      return HttpResponse.json(
        { error: `cannot publish a rule with status: ${rule.status}` },
        { status: 400 }
      );
    }
    rule.status = nextStatus;
    rule.updatedAt = new Date().toISOString();

    return HttpResponse.json({ ...rule });
  }),

  http.post(`${MSW_PACT_BASE}/gateway/v1/rules/:id/revoke`, ({ params }) => {
    const rule = policyRules.find((r) => r.id === params.id);
    if (!rule) {
      return HttpResponse.json({ error: 'rule not found' }, { status: 404 });
    }
    const nextStatus = REVOKE_TRANSITIONS[rule.status];
    if (!nextStatus) {
      return HttpResponse.json(
        { error: `cannot revoke a rule with status: ${rule.status}` },
        { status: 400 }
      );
    }
    rule.status = nextStatus;
    rule.updatedAt = new Date().toISOString();

    return HttpResponse.json({ ...rule });
  }),
];

import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { type PolicyEvent } from '@/src/app/policy/domain/policy_event';
import { type PolicyRule } from '@/src/app/policy/domain/policy_rule';
import {
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
} from '@/src/app/policy/domain/policy_token';
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

interface IssueTokenBody {
  agentId?: string;
  toolId?: string;
  scopes?: string[];
  ttlSeconds?: number;
}

// Valid publish/revoke transitions enforced by the mock.
const PUBLISH_TRANSITIONS: Record<string, string> = { draft: 'published' };
const REVOKE_TRANSITIONS: Record<string, string> = { published: 'revoked' };

// The real gateway writes a bare string error body (boundary.GRPCErrorBody:
// NotFound -> "not found", InvalidArgument/FailedPrecondition -> "invalid
// request"), and the vendored OpenAPI types these error responses as
// `type: string`. Return the string (not a `{ error }` object) so the mock,
// the generated client's `data: string`, and the gateway contract all agree.
const GATEWAY_NOT_FOUND = 'not found';
const GATEWAY_INVALID_REQUEST = 'invalid request';

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
      return HttpResponse.json(GATEWAY_NOT_FOUND, { status: 404 });
    }
    const nextStatus = PUBLISH_TRANSITIONS[rule.status];
    if (!nextStatus) {
      return HttpResponse.json(GATEWAY_INVALID_REQUEST, { status: 400 });
    }
    rule.status = nextStatus;
    rule.updatedAt = new Date().toISOString();

    return HttpResponse.json({ ...rule });
  }),

  http.post(`${MSW_PACT_BASE}/gateway/v1/rules/:id/revoke`, ({ params }) => {
    const rule = policyRules.find((r) => r.id === params.id);
    if (!rule) {
      return HttpResponse.json(GATEWAY_NOT_FOUND, { status: 404 });
    }
    const nextStatus = REVOKE_TRANSITIONS[rule.status];
    if (!nextStatus) {
      return HttpResponse.json(GATEWAY_INVALID_REQUEST, { status: 400 });
    }
    rule.status = nextStatus;
    rule.updatedAt = new Date().toISOString();

    return HttpResponse.json({ ...rule });
  }),

  http.post(
    `${MSW_PACT_BASE}/gateway/v1/policy/tokens`,
    async ({ request }) => {
      const body = (await request.json()) as IssueTokenBody;

      // Mirrors pact-gateway's documented runtime validation (api/swagger/
      // policy.yaml's 400 response: "agentId, toolId required; scopes must be
      // non-empty; ttlSeconds must be 1..86400"), not just the OpenAPI shape
      // (every field there is optional) -- same pattern as the classifier
      // label mock enforcing handler.go's runtime rules over the lenient spec.
      if (
        !body.agentId ||
        !body.toolId ||
        !Array.isArray(body.scopes) ||
        body.scopes.length === 0 ||
        !Number.isInteger(body.ttlSeconds) ||
        (body.ttlSeconds as number) < MIN_TTL_SECONDS ||
        (body.ttlSeconds as number) > MAX_TTL_SECONDS
      ) {
        // HttpResponse.json (not .text): the generated issueToken fetcher
        // always JSON.parses the response body regardless of status
        // (src/__codegen__/rest/policy/fetchers.ts), so an unquoted text body
        // would throw a SyntaxError instead of surfacing as a normal 400 --
        // same reason the publish/revoke handlers above use .json for their
        // error string.
        return HttpResponse.json(GATEWAY_INVALID_REQUEST, { status: 400 });
      }

      const token = `pact-cap-${uuidv4()}`;
      const expiresAtUnix =
        Math.floor(Date.now() / 1000) + (body.ttlSeconds as number);

      return HttpResponse.json({ token, expiresAtUnix }, { status: 201 });
    }
  ),
];

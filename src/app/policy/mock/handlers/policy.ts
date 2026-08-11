import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';
import {
  MAX_TTL_SECONDS,
  MIN_TTL_SECONDS,
} from '@/src/app/policy/domain/policy_token';
import { MSW_PACT_BASE } from '@/src/framework/msw';

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
  http.get('*/v1/audit/policy-events', () => {
    const events = db.policyEvents.getAll();

    return HttpResponse.json({ events, total: events.length });
  }),

  http.get(`${MSW_PACT_BASE}/gateway/v1/rules`, () =>
    HttpResponse.json({
      rules: [...db.policyRules.getAll()].sort((a, b) =>
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
    const rule = db.policyRules.create({
      name: body.name,
      status: 'draft',
      version: 1,
    });

    return HttpResponse.json(rule, { status: 201 });
  }),

  http.post(`${MSW_PACT_BASE}/gateway/v1/rules/:id/publish`, ({ params }) => {
    const existing = db.policyRules.findFirst((r) => r.id === params.id);
    if (!existing) {
      return HttpResponse.json(GATEWAY_NOT_FOUND, { status: 404 });
    }
    const nextStatus = PUBLISH_TRANSITIONS[existing.status];
    if (!nextStatus) {
      return HttpResponse.json(GATEWAY_INVALID_REQUEST, { status: 400 });
    }
    const rule = db.policyRules.update(
      (r) => r.id === params.id,
      (r) => ({ ...r, status: nextStatus, updatedAt: new Date().toISOString() })
    );
    // update() returns T | undefined; the findFirst check above guarantees a
    // match here, but guard it explicitly rather than relying on that -
    // mirrors files.ts's /confirm handler, the established pattern for
    // MockRepository.update() call sites in this codebase.
    if (!rule) {
      return HttpResponse.json(GATEWAY_NOT_FOUND, { status: 404 });
    }

    return HttpResponse.json(rule);
  }),

  http.post(`${MSW_PACT_BASE}/gateway/v1/rules/:id/revoke`, ({ params }) => {
    const existing = db.policyRules.findFirst((r) => r.id === params.id);
    if (!existing) {
      return HttpResponse.json(GATEWAY_NOT_FOUND, { status: 404 });
    }
    const nextStatus = REVOKE_TRANSITIONS[existing.status];
    if (!nextStatus) {
      return HttpResponse.json(GATEWAY_INVALID_REQUEST, { status: 400 });
    }
    const rule = db.policyRules.update(
      (r) => r.id === params.id,
      (r) => ({ ...r, status: nextStatus, updatedAt: new Date().toISOString() })
    );
    if (!rule) {
      return HttpResponse.json(GATEWAY_NOT_FOUND, { status: 404 });
    }

    return HttpResponse.json(rule);
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

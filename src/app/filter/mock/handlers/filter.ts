import { http, HttpResponse, type RequestHandler } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import { type FilterTestRuleRequest } from '@/src/__codegen__/rest/filter';
import {
  computeDecisionStats,
  MOCK_LOADED_PACKS,
} from '@/src/app/filter/mock/data/filter';
import { MSW_PACT_BASE } from '@/src/framework/msw';
import { operatorOnlyForbiddenResponse } from '@/src/framework/msw/operator_gate';

// Mirrors pact-gateway internal/features/filter/handler.go's
// validateTestRuleRequest so dev:mock and Playwright catch the same
// missing-field/invalid-kind mistakes a real gateway would 400 on.
const validateTestRuleRequest = (
  body: FilterTestRuleRequest
): string | undefined => {
  if (!body.pattern?.trim()) return 'pattern is required';
  if (!body.verdict?.trim()) return 'verdict is required';
  if (!body.content?.trim()) return 'content is required';
  if (!['input', 'output', 'external_content'].includes(body.kind)) {
    return 'kind must be one of "input", "output", or "external_content"';
  }

  return undefined;
};

export const handlers: RequestHandler[] = [
  http.get(`${MSW_PACT_BASE}/gateway/v1/filter/packs`, () =>
    HttpResponse.json({ packs: MOCK_LOADED_PACKS })
  ),
  // Evaluates the candidate pattern as a case-insensitive regex against the
  // sample content, mirroring pact-filter's real regex-engine matching
  // closely enough for the sandbox to feel genuinely interactive in
  // dev:mock: a matching pattern/content pair reports the requested verdict,
  // anything else reports "safe". An invalid pattern fails safe as "no
  // match" rather than 500ing, same as a real engine would on a malformed
  // rule.
  http.post(
    `${MSW_PACT_BASE}/gateway/v1/filter/test-rule`,
    async ({ request }) => {
      const body = (await request.json()) as FilterTestRuleRequest;
      const validationError = validateTestRuleRequest(body);
      if (validationError) {
        return HttpResponse.text(validationError, { status: 400 });
      }

      let match: RegExpMatchArray | null = null;
      try {
        match = body.content.match(new RegExp(body.pattern, 'i'));
      } catch {
        match = null;
      }

      if (!match) {
        return HttpResponse.json({
          verdict: 'safe',
          ruleId: body.ruleId || undefined,
          confidence: 0,
          reason: 'no match',
          latencyMs: 3,
          normalizedInput: body.content.toLowerCase(),
        });
      }

      return HttpResponse.json({
        verdict: body.verdict,
        ruleId: body.ruleId || 'candidate',
        confidence: body.confidence ?? 0.87,
        reason: 'pattern matched sample content',
        latencyMs: 4,
        normalizedInput: body.content.toLowerCase(),
        matchedSpan: {
          start: match.index ?? 0,
          end: (match.index ?? 0) + match[0].length,
          text: match[0],
        },
        sanitized: false,
      });
    }
  ),
  // GET /v1/audit/events (every topic, pact.decisions included) is answered
  // by the audit feature handler; only the decision-derived stats live here.
  http.get('*/v1/audit/stats', ({ request }) => {
    const forbidden = operatorOnlyForbiddenResponse();
    if (forbidden) return forbidden;

    const url = new URL(request.url);
    const sinceUnixParam = url.searchParams.get('sinceUnix');
    const untilUnixParam = url.searchParams.get('untilUnix');

    const stats = computeDecisionStats(db.decisions.getAll(), {
      sinceUnix: sinceUnixParam === null ? undefined : Number(sinceUnixParam),
      untilUnix: untilUnixParam === null ? undefined : Number(untilUnixParam),
    });

    return HttpResponse.json(stats);
  }),
];

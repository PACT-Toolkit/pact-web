import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';
import { runRedactor } from '@/src/app/redactor/mock/data/redactor';
import { MSW_PACT_BASE } from '@/src/framework/msw';

import { runClassifier, runFilter } from '../data/test_lab';

export const handlers: RequestHandler[] = [
  http.get(`${MSW_PACT_BASE}/benchmark/v1/corpus/examples`, () =>
    HttpResponse.json(db.attackExamples.getAll())
  ),

  http.post(`${MSW_PACT_BASE}/gateway/v1/check`, async ({ request }) => {
    const body = (await request.json()) as {
      content?: string;
      kind?: string;
      _bypass_layers?: string[];
    };
    const content = body.content ?? '';
    const bypass = body._bypass_layers ?? [];

    await new Promise((r) => setTimeout(r, 120 + Math.random() * 80));

    const filterBypassed = bypass.includes('filter');
    const filterResult = filterBypassed ? null : runFilter(content);
    const shouldRunClassifier =
      filterBypassed || filterResult?.decision === 'allow';
    const classifierResult = shouldRunClassifier
      ? runClassifier(content)
      : null;

    const decision =
      filterResult?.decision === 'block'
        ? 'block'
        : classifierResult?.decision === 'block'
          ? 'block'
          : 'allow';

    // Redactor runs regardless of decision/kind, same as the real gateway
    // (pact-redactor is bidirectional -- see README.md). Shared with
    // createRedactorMockData's seed data via redactor/mock/data/redactor.ts
    // so /redactor's ad-hoc test panel (PACT-324) exercises the same
    // detection logic as the live console's fixtures.
    const redactorResult = runRedactor(content);

    return HttpResponse.json({
      request_id: `req-test-${uuidv4().slice(0, 6)}`,
      decision,
      reason:
        filterResult?.decision === 'block'
          ? 'filter_hostile'
          : classifierResult?.decision === 'block'
            ? 'classifier_hostile'
            : undefined,
      filter_rule_id:
        filterResult?.decision === 'block' ? filterResult.ruleId : undefined,
      classifier: classifierResult
        ? { label: classifierResult.label, score: classifierResult.confidence }
        : undefined,
      redactor: redactorResult,
      latency_ms: Math.floor(3 + Math.random() * 8),
      _mock_layers: [
        filterBypassed
          ? {
              name: 'filter',
              decision: 'skip',
              reason: 'Bypassed by user',
              latency_ms: 0,
              confidence: 0,
            }
          : {
              name: 'filter',
              decision: filterResult!.decision,
              rule_id: filterResult!.ruleId,
              reason: filterResult!.reason ?? 'No rule match',
              latency_ms: Math.floor(1 + Math.random() * 4),
              confidence: filterResult!.confidence,
            },
        classifierResult
          ? {
              name: 'classifier',
              decision: classifierResult.decision,
              label: classifierResult.label,
              reason: classifierResult.reason ?? 'Clean input',
              latency_ms: Math.floor(12 + Math.random() * 22),
              confidence: classifierResult.confidence,
            }
          : {
              name: 'classifier',
              decision: 'skip',
              reason: 'Skipped — filter blocked',
              latency_ms: 0,
              confidence: 0,
            },
      ],
    });
  }),

  http.post(`${MSW_PACT_BASE}/benchmark/v1/corpus`, async () => {
    await new Promise((r) => setTimeout(r, 60));

    return HttpResponse.json(
      { id: uuidv4(), status: 'created' },
      { status: 201 }
    );
  }),

  http.get(`${MSW_PACT_BASE}/benchmark/v1/testlab/runs`, ({ request }) => {
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const all = [...db.testLabRuns.getAll()].reverse();
    const page = all.slice(offset, offset + limit);

    return HttpResponse.json({ runs: page, total: all.length });
  }),

  http.post(
    `${MSW_PACT_BASE}/benchmark/v1/testlab/runs`,
    async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const run = db.testLabRuns.create({
        id: uuidv4(),
        content: String(body.content ?? ''),
        attack_type: String(body.attack_type ?? 'custom'),
        decision: body.decision === 'block' ? 'block' : 'allow',
        reason: String(body.reason ?? ''),
        filter_rule_id: String(body.filter_rule_id ?? ''),
        latency_ms: Number(body.latency_ms ?? 0),
        request_id: String(body.request_id ?? ''),
        created_at: Math.floor(Date.now() / 1000),
      });

      return HttpResponse.json({ id: run.id }, { status: 201 });
    }
  ),
];

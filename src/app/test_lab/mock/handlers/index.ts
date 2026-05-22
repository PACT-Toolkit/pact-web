import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';

import { runClassifier, runFilter } from '../data';

export const handlers: RequestHandler[] = [
  http.get('*/v1/benchmark/corpus/examples', () =>
    HttpResponse.json(db.attackExamples.getAll()),
  ),

  http.post('*/v1/check', async ({ request }) => {
    const body = (await request.json()) as {
      content?: string;
      kind?: string;
      _bypass_layers?: string[];
    };
    const content = body.content ?? '';
    const bypass = body._bypass_layers ?? [];

    await new Promise(r => setTimeout(r, 120 + Math.random() * 80));

    const filterBypassed = bypass.includes('filter');
    const filterResult = filterBypassed ? null : runFilter(content);
    const shouldRunClassifier = filterBypassed || filterResult?.decision === 'allow';
    const classifierResult = shouldRunClassifier ? runClassifier(content) : null;

    const decision =
      filterResult?.decision === 'block'
        ? 'block'
        : classifierResult?.decision === 'block'
          ? 'block'
          : 'allow';

    return HttpResponse.json({
      request_id: `req-test-${uuidv4().slice(0, 6)}`,
      decision,
      reason:
        filterResult?.decision === 'block'
          ? 'filter_hostile'
          : classifierResult?.decision === 'block'
            ? 'classifier_hostile'
            : undefined,
      filter_rule_id: filterResult?.decision === 'block' ? filterResult.ruleId : undefined,
      latency_ms: Math.floor(3 + Math.random() * 8),
      _mock_layers: [
        filterBypassed
          ? { name: 'filter', decision: 'skip', reason: 'Bypassed by user', latency_ms: 0, confidence: 0 }
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

  http.post('*/v1/benchmark/corpus', async () => {
    await new Promise(r => setTimeout(r, 60));

    return HttpResponse.json({ id: uuidv4(), status: 'created' }, { status: 201 });
  }),
];

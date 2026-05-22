import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { mockDecisionEvents } from '../data';

// ─── filter simulation ────────────────────────────────────────────────────────

const INJECTION_RULES: [RegExp, string][] = [
  [/ignore\s+(all\s+|previous\s+|prior\s+)?instructions/i, 'inject-001'],
  [/system\s+prompt/i, 'inject-002'],
  [/\[INST\]/, 'inject-003'],
  [/forget\s+(everything|all\s+(you|your))/i, 'inject-004'],
  [/<\|.*?\|>/i, 'inject-005'],
];
const ROLE_RULES: [RegExp, string][] = [
  [/pretend\s+(you\s+are|to\s+be)/i, 'role-001'],
  [/roleplay\s+as/i, 'role-002'],
  [/act\s+as\s+(if|a\s+)/i, 'role-003'],
  [/you\s+have\s+no\s+(restrictions|limits|guidelines)/i, 'role-004'],
  [/you\s+are\s+(now\s+)?(DAN|an?\s+unrestricted)/i, 'role-005'],
];
const JAILBREAK_RULES: [RegExp, string][] = [
  [/do\s+anything\s+now/i, 'jailbreak-001'],
  [/jailbreak/i, 'jailbreak-002'],
  [/bypass\s+.*(restrictions|safety|filters)/i, 'jailbreak-003'],
  [/developer\s+mode/i, 'jailbreak-004'],
];

function runFilter(
  content: string,
): { decision: 'allow' | 'block'; ruleId?: string; reason?: string; confidence: number } {
  for (const [pattern, ruleId] of [...INJECTION_RULES, ...ROLE_RULES, ...JAILBREAK_RULES]) {
    if (pattern.test(content)) {
      return {
        decision: 'block',
        ruleId,
        reason: `Pattern match: ${ruleId.split('-')[0]} attack`,
        confidence: 0.92 + Math.random() * 0.07,
      };
    }
  }

  return { decision: 'allow', confidence: 0.98 };
}

const HOSTILE_WORDS = ['weapon', 'bomb', 'hack', 'exploit', 'malware', 'bypass', 'kill', 'hurt'];

function runClassifier(
  content: string,
): { decision: 'allow' | 'block'; reason?: string; confidence: number } {
  const lower = content.toLowerCase();
  const hits = HOSTILE_WORDS.filter(w => lower.includes(w)).length;
  if (hits >= 2) {
    return { decision: 'block', reason: 'Semantic hostility detected', confidence: 0.68 + Math.random() * 0.22 };
  }
  if (hits === 1 && Math.random() > 0.65) {
    return { decision: 'block', reason: 'Low-confidence hostile content', confidence: 0.5 + Math.random() * 0.18 };
  }

  return { decision: 'allow', confidence: 0.84 + Math.random() * 0.12 };
}

// ─── handlers ────────────────────────────────────────────────────────────────

export const handlers: RequestHandler[] = [
  // GET audit events
  http.get('*/v1/audit/events', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('topic') !== 'pact.decisions') return undefined;

    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const page = mockDecisionEvents.slice(offset, offset + limit);

    return HttpResponse.json({ events: page, total: mockDecisionEvents.length });
  }),

  // POST check — simulate filter + classifier pipeline
  http.post('*/v1/check', async ({ request }) => {
    const body = (await request.json()) as {
      content?: string;
      kind?: string;
      _bypass_layers?: string[];
    };
    const content = body.content ?? '';
    const bypass = body._bypass_layers ?? [];

    // Simulate realistic latency
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

  // POST benchmark corpus — save confirmed malicious prompt
  http.post('*/v1/benchmark/corpus', async () => {
    await new Promise(r => setTimeout(r, 60));

    return HttpResponse.json({ id: uuidv4(), status: 'created' }, { status: 201 });
  }),
];

import { type DB } from '@/mocks/data/dbFactory';
import { type CheckRedactedSpan } from '@/src/__codegen__/rest/check';
import { type DecisionPayload } from '@/src/app/audit/domain/audit_decision_payload';

// PII detection patterns backing both this file's own seed rows and the
// mocked /v1/check response (test_lab/mock/handlers/test_lab.ts imports
// runRedactor, since /v1/check is shared plumbing owned by that handler --
// see its header comment). Deliberately simple regexes: dev:mock only
// needs plausible-looking spans for the UI to render, not production-grade
// PII detection, which lives in pact-redactor.
const PII_PATTERNS: [RegExp, string][] = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, 'EMAIL'],
  [/\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, 'PHONE'],
  [/\b\d{3}-\d{2}-\d{4}\b/g, 'SSN'],
];

export const runRedactor = (
  content: string
): { verdict: string; spans: CheckRedactedSpan[] } => {
  const spans: CheckRedactedSpan[] = [];

  for (const [pattern, label] of PII_PATTERNS) {
    // Fresh RegExp per call: PII_PATTERNS' entries carry the `g` flag, and a
    // shared stateful RegExp would leak lastIndex across requests since
    // this runs on every mocked /v1/check POST.
    const re = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = re.exec(content)) !== null) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        label,
      });
    }
  }

  spans.sort((a, b) => a.start - b.start);

  return {
    verdict: spans.length > 0 ? 'redacted' : 'pass_through',
    spans,
  };
};

// Redactor scenario templates seeded onto the shared db.decisions
// repository, mirroring consensus.ts's approach: a redactor record is just
// a pact.decisions payload carrying a `redactor` sub-object (see
// redactor_record.ts) -- pact-gateway has no dedicated redactor endpoint.
const SCENARIOS: ((index: number) => DecisionPayload)[] = [
  // Pass-through: no PII detected.
  (index) => ({
    decision: 'allow',
    engine: 'gateway-v1',
    redactor: { verdict: 'pass_through', spans: [] },
    latency_ms: 40 + index,
  }),
  // Single email address redacted.
  (index) => ({
    decision: 'allow',
    engine: 'gateway-v1',
    redactor: {
      verdict: 'redacted',
      spans: [{ start: 14, end: 34, label: 'EMAIL' }],
    },
    latency_ms: 52 + index,
  }),
  // Multiple PII types redacted in one response.
  (index) => ({
    decision: 'allow',
    engine: 'gateway-v1',
    redactor: {
      verdict: 'redacted',
      spans: [
        { start: 8, end: 20, label: 'PHONE' },
        { start: 45, end: 56, label: 'SSN' },
      ],
    },
    latency_ms: 61 + index,
  }),
  // Redacted alongside a blocked filter decision -- the redactor stage
  // still runs even when the request was ultimately blocked upstream.
  (index) => ({
    decision: 'block',
    reason: 'filter_hostile',
    filter_rule_id: 'inject-003',
    engine: 'gateway-v1',
    filter: { verdict: 'hostile', rule_id: 'inject-003' },
    redactor: {
      verdict: 'redacted',
      spans: [{ start: 0, end: 11, label: 'API_KEY' }],
    },
    latency_ms: 8 + index,
  }),
  // Pass-through on a longer, benign request.
  (index) => ({
    decision: 'allow',
    engine: 'gateway-v1',
    redactor: { verdict: 'pass_through', spans: [] },
    latency_ms: 35 + index,
  }),
];

// Number of redactor-bearing rows to seed. Deliberately > PAGE_SIZE (25,
// redactor_record.ts) so /redactor's client-side pagination has more than
// one page to page through in dev:mock, same as consensus.ts's ROW_COUNT.
const ROW_COUNT = 30;

export const createRedactorMockData = (db: DB): void => {
  const min = 60_000;

  for (let i = 0; i < ROW_COUNT; i++) {
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const payload = scenario(i);
    const requestId = `req-redactor-${i.toString().padStart(2, '0')}`;
    // Offsets land 2min15s apart -- staggered from filter.ts's whole-minute
    // offsets and consensus.ts's 4min+90s offsets so all three seeders
    // appending to the shared db.decisions repository never collide on the
    // same createdAt (see consensus.ts's header comment for why collisions
    // matter here).
    const offsetMs = (i + 1) * 2 * min + 15_000;
    const createdAt = new Date(Date.now() - offsetMs).toISOString();

    db.decisions.create({
      requestId,
      payloadJson: JSON.stringify({
        ...payload,
        request_id: requestId,
        created_at: createdAt,
      }),
      createdAt,
    });
  }
};

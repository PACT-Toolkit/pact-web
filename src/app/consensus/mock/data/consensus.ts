import { type DB } from '@/mocks/data/dbFactory';
import { type DecisionPayload } from '@/src/app/audit/domain/audit_decision_payload';

// Consensus scenario templates, one per flag consensus_flags.ts can raise
// (SPLIT / NO QUORUM / FAIL-OPEN / LOW CONFIDENCE) plus a clean, unflagged
// escalation -- so /consensus's "Flagged only" toggle and all four
// highlight badges have real data to render in dev:mock. These are layered
// onto db.decisions rather than a new repository, since a consensus record
// is just a pact.decisions payload carrying a `consensus` sub-object (see
// consensus_record.ts) -- pact-gateway has no dedicated consensus endpoint.
const SCENARIOS: ((index: number) => DecisionPayload)[] = [
  // Clean: quorum reached, all three backends agree. Not flagged.
  (index) => ({
    decision: 'block',
    reason: 'consensus_jailbreak',
    engine: 'gateway-v1',
    classifier: {
      label: 'jailbreak',
      score: 0.58,
      engine: 'deberta-v3-pact-injection-v1',
    },
    consensus: {
      label: 'jailbreak',
      confidence: 0.93,
      quorum_reached: true,
      backend_count: 3,
      votes: [
        { backend_id: 'claude-haiku', label: 'jailbreak', score: 0.95 },
        { backend_id: 'gpt-4o-mini', label: 'jailbreak', score: 0.91 },
        { backend_id: 'gemini-flash', label: 'jailbreak', score: 0.93 },
      ],
    },
    latency_ms: 340 + index,
  }),
  // Split: backends disagree on the winning label. Flagged (SPLIT).
  (index) => ({
    decision: 'block',
    reason: 'consensus_split',
    engine: 'gateway-v1',
    classifier: {
      label: 'suspicious',
      score: 0.5,
      engine: 'deberta-v3-pact-injection-v1',
    },
    consensus: {
      label: 'jailbreak',
      confidence: 0.61,
      quorum_reached: true,
      backend_count: 3,
      votes: [
        { backend_id: 'claude-haiku', label: 'jailbreak', score: 0.7 },
        { backend_id: 'gpt-4o-mini', label: 'suspicious', score: 0.55 },
        { backend_id: 'gemini-flash', label: 'jailbreak', score: 0.66 },
      ],
    },
    latency_ms: 410 + index,
  }),
  // No quorum: too few backends agreed. Flagged (NO QUORUM).
  (index) => ({
    decision: 'allow',
    reason: 'consensus_no_quorum',
    engine: 'gateway-v1',
    classifier: {
      label: 'suspicious',
      score: 0.52,
      engine: 'deberta-v3-pact-injection-v1',
    },
    consensus: {
      label: 'suspicious',
      confidence: 0.48,
      quorum_reached: false,
      backend_count: 2,
      votes: [
        { backend_id: 'claude-haiku', label: 'suspicious', score: 0.5 },
        { backend_id: 'gpt-4o-mini', label: 'safe', score: 0.4 },
      ],
    },
    latency_ms: 520 + index,
  }),
  // Fail-open: consensus backend unreachable, classifier result preserved.
  // Flagged (FAIL-OPEN).
  (index) => ({
    decision: 'allow',
    reason: 'consensus_fail_open',
    engine: 'gateway-v1',
    classifier: {
      label: 'suspicious',
      score: 0.53,
      engine: 'deberta-v3-pact-injection-v1',
    },
    consensus: {
      label: 'suspicious',
      skipped: true,
    },
    latency_ms: 205 + index,
  }),
  // Low confidence: quorum reached but weak agreement. Flagged (LOW
  // CONFIDENCE).
  (index) => ({
    decision: 'block',
    reason: 'consensus_low_confidence',
    engine: 'gateway-v1',
    classifier: {
      label: 'jailbreak',
      score: 0.55,
      engine: 'deberta-v3-pact-injection-v1',
    },
    consensus: {
      label: 'jailbreak',
      confidence: 0.42,
      quorum_reached: true,
      backend_count: 3,
      votes: [
        { backend_id: 'claude-haiku', label: 'jailbreak', score: 0.45 },
        { backend_id: 'gpt-4o-mini', label: 'jailbreak', score: 0.4 },
        { backend_id: 'gemini-flash', label: 'jailbreak', score: 0.41 },
      ],
    },
    latency_ms: 380 + index,
  }),
  // Clean and unflagged: high confidence, quorum, unanimous "safe" verdict
  // overriding a borderline classifier score.
  (index) => ({
    decision: 'allow',
    reason: 'consensus_confirmed_safe',
    engine: 'gateway-v1',
    classifier: {
      label: 'suspicious',
      score: 0.5,
      engine: 'deberta-v3-pact-injection-v1',
    },
    consensus: {
      label: 'safe',
      confidence: 0.97,
      quorum_reached: true,
      backend_count: 3,
      votes: [
        { backend_id: 'claude-haiku', label: 'safe', score: 0.98 },
        { backend_id: 'gpt-4o-mini', label: 'safe', score: 0.96 },
        { backend_id: 'gemini-flash', label: 'safe', score: 0.97 },
      ],
    },
    latency_ms: 300 + index,
  }),
];

// Number of consensus-bearing rows to seed. Deliberately > PAGE_SIZE (25,
// consensus_record.ts) so /consensus's client-side pagination has more
// than one page to page through in dev:mock.
const ROW_COUNT = 30;

export const createConsensusMockData = (db: DB): void => {
  const min = 60_000;

  for (let i = 0; i < ROW_COUNT; i++) {
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const payload = scenario(i);
    const requestId = `req-consensus-${i.toString().padStart(2, '0')}`;
    // Offsets land on a half-minute (X*4min + 90s) so they never collide
    // with filter.ts's whole-minute offsets for the same db.decisions
    // repository -- collisions would only produce a harmless sort tie, but
    // distinct offsets keep "newest first" ordering fully deterministic.
    const offsetMs = (i + 1) * 4 * min + 90_000;
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

import { type DB } from '@/mocks/data/dbFactory';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

// Classifier scenario templates seeded onto the shared db.decisions
// repository, mirroring redactor.ts's/consensus.ts's approach: a classifier
// record is just a pact.decisions payload carrying a `classifier`
// sub-object (see classifier_record.ts) -- pact-gateway has no dedicated
// classifier-feed endpoint.
//
// Every score here sits comfortably above PACT_CONSENSUS_THRESHOLD, so none
// of these rows also carry a `consensus` sub-object -- they exercise the
// "classifier decided on its own" lens of the console. The below-threshold,
// consensus-arbitrated lens is already covered by createConsensusMockData's
// rows, which embed their own `classifier` sub-object alongside `consensus`
// (see consensus.ts) and so also show up here as CONSENSUS ARBITRATED rows,
// same as they would against the real gateway.
const SCENARIOS: ((index: number) => DecisionPayload)[] = [
  // Confident benign: allowed straight through.
  (index) => ({
    decision: 'allow',
    engine: 'classifier',
    classifier: {
      label: 'benign',
      score: 0.97,
      engine: 'deberta-v3-pact-injection-v1',
    },
    latency_ms: 18 + index,
  }),
  // Confident prompt injection: blocked without needing consensus.
  (index) => ({
    decision: 'block',
    reason: 'classifier_prompt_injection',
    engine: 'classifier',
    classifier: {
      label: 'prompt_injection',
      score: 0.94,
      engine: 'deberta-v3-pact-injection-v1',
    },
    latency_ms: 22 + index,
  }),
  // Confident jailbreak: blocked without needing consensus.
  (index) => ({
    decision: 'block',
    reason: 'classifier_jailbreak',
    engine: 'classifier',
    classifier: {
      label: 'jailbreak',
      score: 0.91,
      engine: 'deberta-v3-pact-injection-v1',
    },
    latency_ms: 25 + index,
  }),
  // Sensitive content flagged but allowed through (the redactor stage, not
  // the classifier, is responsible for masking it).
  (index) => ({
    decision: 'allow',
    engine: 'classifier',
    classifier: {
      label: 'sensitive',
      score: 0.88,
      engine: 'stub-v1',
    },
    latency_ms: 20 + index,
  }),
  // Unknown label from an older/stub engine build that hasn't been tuned
  // for this checkpoint yet, still confident enough to skip consensus.
  (index) => ({
    decision: 'allow',
    engine: 'classifier',
    classifier: {
      label: 'unknown',
      score: 0.86,
      engine: 'stub-v1',
    },
    latency_ms: 15 + index,
  }),
];

// Number of classifier-bearing rows to seed. Deliberately > PAGE_SIZE (25,
// classifier_record.ts) so /classifier's client-side pagination has more
// than one page to page through in dev:mock, same as consensus.ts's and
// redactor.ts's ROW_COUNT.
const ROW_COUNT = 30;

export const createClassifierMockData = (db: DB): void => {
  const min = 60_000;

  for (let i = 0; i < ROW_COUNT; i++) {
    const scenario = SCENARIOS[i % SCENARIOS.length];
    const payload = scenario(i);
    const requestId = `req-classifier-${i.toString().padStart(2, '0')}`;
    // Offsets land 3min45s apart -- staggered from filter.ts's whole-minute
    // offsets, consensus.ts's 4min+90s offsets, and redactor.ts's 2min+15s
    // offsets so all four seeders appending to the shared db.decisions
    // repository never collide on the same createdAt (see consensus.ts's
    // header comment for why collisions matter here).
    const offsetMs = (i + 1) * 3 * min + 45_000;
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

import { type DB } from '@/mocks/data/dbFactory';
import { type ControlRef } from '@/src/__codegen__/schema/pact-decisions';
import {
  parseDecisionPayload,
  type DecisionPayload,
} from '@/src/lib/decisions/decision_payload';

// Mock-side stand-in for what the gateway stamps onto every pact.decisions
// event: the executed stage list, per-stage duration, the static per-stage
// compliance controls and the loaded rule pack. The four decision seeders
// (filter, consensus, redactor, classifier) build payloads without these
// fields; enriching them in ONE pass after all four have run keeps this
// knowledge in a single place instead of repeating it in every scenario.

// The gateway's full stage vocabulary in execution order.
const STAGE_ORDER = [
  'policy',
  'filter',
  'classifier',
  'compliance',
  'sandbox',
  'consensus',
  'redactor',
  'tool_mitigation',
  'cel',
] as const;

type StageName = (typeof STAGE_ORDER)[number];

// `engine` (the blocker) to the stage that produced it. `gateway` is a
// pre-pipeline rejection: no stage ran, so no stage list is stamped.
const ENGINE_STAGE: Partial<Record<string, StageName>> = {
  policy: 'policy',
  filter: 'filter',
  classifier: 'classifier',
  sandbox: 'sandbox',
  consensus: 'consensus',
  redactor: 'redactor',
  cel: 'cel',
};

const OWASP = 'owasp_llm_top10';
const AI_ACT = 'eu_ai_act_art15';

// The gateway's static per-stage control table.
const FILTER_CONTROLS: ControlRef[] = [
  { framework: OWASP, id: 'LLM01' },
  { framework: AI_ACT, id: 'cybersecurity' },
];
const CLASSIFIER_CONTROLS: ControlRef[] = [
  { framework: OWASP, id: 'LLM01' },
  { framework: AI_ACT, id: 'accuracy' },
];
const CONSENSUS_CONTROLS: ControlRef[] = [
  { framework: OWASP, id: 'LLM01' },
  { framework: AI_ACT, id: 'robustness' },
];
const REDACTOR_CONTROLS: ControlRef[] = [
  { framework: OWASP, id: 'LLM02' },
  { framework: AI_ACT, id: 'cybersecurity' },
];
const POLICY_CONTROLS: ControlRef[] = [
  { framework: OWASP, id: 'LLM06' },
  { framework: AI_ACT, id: 'cybersecurity' },
];
const SANDBOX_CONTROLS: ControlRef[] = [
  { framework: OWASP, id: 'LLM01' },
  { framework: AI_ACT, id: 'cybersecurity' },
];

// Typical stage cost in ms; a small request-id derived relative jitter keeps
// rows from all showing identical timings. The redactor sits under 1 ms so
// the sub-millisecond path (`duration_us` below 1000) shows up in dev:mock.
const BASE_DURATION_MS = {
  policy: 1,
  filter: 3,
  classifier: 38,
  compliance: 45,
  sandbox: 120,
  consensus: 410,
  redactor: 0.35,
  cel: 2,
};

const JITTER_STEPS = 7;
const MAX_RELATIVE_JITTER = 0.5;
const MICROSECONDS_PER_MILLISECOND = 1000;

// Stable per-request multiplier in [1, 1 + MAX_RELATIVE_JITTER).
const jitterFactor = (seed: string): number =>
  1 +
  (([...seed].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    JITTER_STEPS) /
    JITTER_STEPS) *
    MAX_RELATIVE_JITTER;

const withStageFields = <
  T extends {
    duration_ms?: number;
    duration_us?: number;
    controls?: ControlRef[];
  },
>(
  sub: T,
  base: number,
  seed: string,
  controls?: ControlRef[]
): T & { controls?: ControlRef[] } => {
  // Mirror the gateway: `duration_us` is the primary value, `duration_ms` is
  // its whole-millisecond floor and is omitted when that floor is 0.
  const durationUs =
    sub.duration_us ??
    Math.round(
      (sub.duration_ms ?? base * jitterFactor(seed)) *
        MICROSECONDS_PER_MILLISECOND
    );
  const durationMs = Math.floor(durationUs / MICROSECONDS_PER_MILLISECOND);

  return {
    ...sub,
    duration_us: durationUs,
    ...(durationMs > 0 ? { duration_ms: durationMs } : {}),
    ...(controls && {
      controls: sub.controls ?? controls.map((c) => ({ ...c })),
    }),
  };
};

const executedStages = (payload: DecisionPayload): StageName[] | undefined => {
  const engineStage =
    payload.engine === undefined ? undefined : ENGINE_STAGE[payload.engine];
  if (payload.decision === 'block' && engineStage === undefined) {
    return undefined;
  }

  const present: Record<StageName, boolean> = {
    policy: payload.policy !== undefined,
    filter: payload.filter !== undefined,
    classifier: payload.classifier !== undefined,
    compliance: payload.compliance !== undefined,
    sandbox: payload.external_refs !== undefined,
    consensus: payload.consensus !== undefined,
    redactor: payload.redactor !== undefined,
    tool_mitigation: false,
    cel: payload.cel !== undefined,
  };
  const lastPresent = STAGE_ORDER.reduce(
    (last, stage, index) => (present[stage] ? index : last),
    -1
  );

  if (payload.decision !== 'block') return [...STAGE_ORDER];

  // A block ends the pipeline at the blocking stage; a stage with a
  // sub-object past it (fixtures are hand-written) still counts as run.
  const stop = Math.max(
    STAGE_ORDER.indexOf(engineStage as StageName),
    lastPresent
  );

  return STAGE_ORDER.slice(0, stop + 1);
};

export const enrichDecisionPayload = (
  payload: DecisionPayload
): DecisionPayload => {
  const seed = payload.request_id ?? '';
  const out: DecisionPayload = { ...payload };

  if (payload.policy) {
    out.policy = withStageFields(
      payload.policy,
      BASE_DURATION_MS.policy,
      seed,
      POLICY_CONTROLS
    );
  }
  if (payload.filter) {
    out.filter = {
      ...withStageFields(
        payload.filter,
        BASE_DURATION_MS.filter,
        seed,
        FILTER_CONTROLS
      ),
      pack_name: 'pact-core',
      pack_version: '1.4.0',
    };
  }
  if (payload.classifier) {
    out.classifier = withStageFields(
      payload.classifier,
      BASE_DURATION_MS.classifier,
      seed,
      CLASSIFIER_CONTROLS
    );
  }
  if (payload.compliance) {
    out.compliance = withStageFields(
      payload.compliance,
      BASE_DURATION_MS.compliance,
      seed
    );
  }
  if (payload.external_refs) {
    out.external_refs = withStageFields(
      payload.external_refs,
      BASE_DURATION_MS.sandbox,
      seed,
      SANDBOX_CONTROLS
    );
  }
  if (payload.consensus) {
    out.consensus = withStageFields(
      payload.consensus,
      BASE_DURATION_MS.consensus,
      seed,
      CONSENSUS_CONTROLS
    );
  }
  if (payload.redactor) {
    out.redactor = withStageFields(
      payload.redactor,
      BASE_DURATION_MS.redactor,
      seed,
      REDACTOR_CONTROLS
    );
  }
  if (payload.cel) {
    out.cel = withStageFields(payload.cel, BASE_DURATION_MS.cel, seed);
  }

  const stages = executedStages(payload);
  if (stages) out.stages = payload.stages ?? stages;

  return out;
};

// Called from dbFactory.ts after the last decisions seeder, so every seeded
// pact.decisions row (all four seeders) carries the gateway-stamped fields.
export const createDecisionEnrichmentMockData = (db: DB): void => {
  for (const event of db.decisions.getAll()) {
    const payload = parseDecisionPayload(event.payloadJson ?? '');
    if (!payload) continue;

    db.decisions.update(
      (candidate) => candidate === event,
      (candidate) => ({
        ...candidate,
        payloadJson: JSON.stringify(enrichDecisionPayload(payload)),
      })
    );
  }
};

import {
  type BenchmarkSaveCorpusRequest,
  type BenchmarkSaveTestLabRunRequest,
  type BenchmarkTestLabRunBody,
} from '@/src/__codegen__/rest/benchmark';
import {
  type CheckCheckRequest,
  type CheckCheckResponse,
  CheckCheckResponseDecision,
  CheckExternalRefInfoVerdict,
  CheckFilterInfoVerdict,
  CheckRedactorInfoVerdict,
  CheckSpotlightInfoFormat,
  CheckWrappedChunkTrust,
} from '@/src/__codegen__/rest/check';
import {
  type AttackChip,
  type LayerDecision,
  type LayerState,
} from '@/src/app/test_lab/ui/types';

// ─── API payload types ────────────────────────────────────────────────────────

export interface MockLayer {
  name: string;
  decision: string;
  rule_id?: string;
  reason?: string;
  latency_ms?: number;
  confidence?: number;
  label?: string;
}

// The /v1/check wire types are generated from the gateway's per-tag swagger
// slice (schema/check, pulled from pact-gateway). Alias the codegen names to
// the domain vocabulary the Test Lab UI uses.
//
// pact-gateway PR #134 (master b97e7e4) added swaggo `enums:` tags to the
// closed-set fields of check.CheckResponse, so orval now emits `decision` as
// the literal union CheckCheckResponseDecision ('allow' | 'block') instead of
// a plain string -- CheckResponse no longer needs to hand-refine it the way
// it did pre-PACT-576. Only the mock-only `_mock_layers` escape hatch is
// still added on top: dev:mock returns _mock_layers to drive the pipeline
// animation; the real gateway never emits it.
export type CheckResponse = CheckCheckResponse & {
  _mock_layers?: MockLayer[];
};

// CheckInput is the /v1/check request body plus the mock-only `_bypass_layers`
// hint that lets the Test Lab re-run with a stage skipped (dev:mock reads it;
// the real gateway ignores unknown fields).
export type CheckInput = CheckCheckRequest & { _bypass_layers?: string[] };

// ─── response parsing (PACT-576) ───────────────────────────────────────────────
//
// parse-don't-cast, mirroring parseDecisionPayload in
// src/lib/decisions/decision_payload.ts: validate the wire shape
// instead of trusting an unchecked `as CheckResponse` cast on the parsed JSON
// body. TS types are erased at runtime -- a literal-union field like
// `decision` still needs an explicit value check to actually catch a
// gateway/web contract drift instead of silently passing a stale value
// through.
//
// The value sets below mirror the runtime const objects orval generates
// alongside each literal-union type (CheckCheckResponseDecision,
// CheckFilterInfoVerdict, CheckRedactorInfoVerdict,
// CheckExternalRefInfoVerdict, CheckSpotlightInfoFormat,
// CheckWrappedChunkTrust -- all in src/__codegen__/rest/check/types/), which
// in turn come from the `enums:` tags pact-gateway PR #134 added to
// check.CheckResponse's closed-set fields (schema/check/swagger.yaml). Reuse
// the generated consts rather than hand-listing the values a second time, so
// a future contract change only needs re-vendoring + regen to take effect
// here too.
//
// classifier.label and CheckInput.kind are deliberately NOT validated here --
// pact-gateway does not constrain either to a closed set (classifier labels
// come from whichever model checkpoint is loaded; kind is documented but not
// swagger-`enum`'d), so they stay open strings by design.
//
// Unlike parseDecisionPayload (called per-row while mapping over an array of
// audit events, where returning null-and-skip is the natural shape),
// parseCheckResponse's two call sites (useTestLabRun.runCheck,
// DashboardQuickProbe.runProbe) already wrap the single /v1/check call in a
// try/catch that transitions to an 'error' status. Throwing a structured
// error lets a parse failure fall straight into that existing catch instead
// of requiring a second null-check at every call site.
export class CheckResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckResponseParseError';
  }
}

const DECISIONS: ReadonlySet<string> = new Set(
  Object.values(CheckCheckResponseDecision)
);
const FILTER_VERDICTS: ReadonlySet<string> = new Set(
  Object.values(CheckFilterInfoVerdict)
);
const REDACTOR_VERDICTS: ReadonlySet<string> = new Set(
  Object.values(CheckRedactorInfoVerdict)
);
const EXTERNAL_REF_VERDICTS: ReadonlySet<string> = new Set(
  Object.values(CheckExternalRefInfoVerdict)
);
const SPOTLIGHT_FORMATS: ReadonlySet<string> = new Set(
  Object.values(CheckSpotlightInfoFormat)
);
const SPOTLIGHT_TRUST: ReadonlySet<string> = new Set(
  Object.values(CheckWrappedChunkTrust)
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertEnumField = (
  set: ReadonlySet<string>,
  value: unknown,
  field: string
): void => {
  if (typeof value !== 'string' || !set.has(value)) {
    throw new CheckResponseParseError(
      `check response ${field}: unexpected value ${JSON.stringify(value)}`
    );
  }
};

const assertRecordField = (
  value: unknown,
  field: string
): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new CheckResponseParseError(
      `check response ${field} is not an object`
    );
  }

  return value;
};

const assertArrayField = (value: unknown, field: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new CheckResponseParseError(
      `check response ${field} is not an array`
    );
  }

  return value;
};

// parseCheckResponse validates the /v1/check response body against the
// closed sets its generated wire type now expresses, throwing
// CheckResponseParseError on structural drift instead of letting an
// unchecked cast paper over it.
export const parseCheckResponse = (raw: unknown): CheckResponse => {
  if (!isRecord(raw)) {
    throw new CheckResponseParseError('check response is not an object');
  }

  assertEnumField(DECISIONS, raw.decision, 'decision');
  if (typeof raw.latency_ms !== 'number') {
    throw new CheckResponseParseError('check response latency_ms is missing');
  }
  if (typeof raw.request_id !== 'string') {
    throw new CheckResponseParseError('check response request_id is missing');
  }

  const filter = assertRecordField(raw.filter, 'filter');
  if (filter?.verdict !== undefined) {
    assertEnumField(FILTER_VERDICTS, filter.verdict, 'filter.verdict');
  }

  const redactor = assertRecordField(raw.redactor, 'redactor');
  if (redactor?.verdict !== undefined) {
    assertEnumField(REDACTOR_VERDICTS, redactor.verdict, 'redactor.verdict');
  }

  const externalRefs = assertRecordField(raw.external_refs, 'external_refs');
  if (externalRefs?.refs !== undefined) {
    assertArrayField(externalRefs.refs, 'external_refs.refs').forEach(
      (ref, i) => {
        if (!isRecord(ref)) {
          throw new CheckResponseParseError(
            `check response external_refs.refs[${i}] is not an object`
          );
        }
        if (ref.verdict !== undefined) {
          assertEnumField(
            EXTERNAL_REF_VERDICTS,
            ref.verdict,
            `external_refs.refs[${i}].verdict`
          );
        }
      }
    );
  }

  const spotlight = assertRecordField(raw.spotlight, 'spotlight');
  if (spotlight?.format !== undefined) {
    assertEnumField(SPOTLIGHT_FORMATS, spotlight.format, 'spotlight.format');
  }
  if (spotlight?.chunks !== undefined) {
    assertArrayField(spotlight.chunks, 'spotlight.chunks').forEach(
      (chunk, i) => {
        if (!isRecord(chunk)) {
          throw new CheckResponseParseError(
            `check response spotlight.chunks[${i}] is not an object`
          );
        }
        if (chunk.trust !== undefined) {
          assertEnumField(
            SPOTLIGHT_TRUST,
            chunk.trust,
            `spotlight.chunks[${i}].trust`
          );
        }
      }
    );
  }

  // The checks above have already validated every closed-set field and the
  // three required top-level fields; `raw` is a CheckResponse at this point.
  // Widened through `unknown` because `Record<string, unknown>` and
  // CheckResponse don't structurally overlap enough for a direct assertion
  // (every optional sub-object field is still typed `unknown` here).
  return raw as unknown as CheckResponse;
};

// ─── domain record ────────────────────────────────────────────────────────────

export interface TestRun {
  id: string;
  input: string;
  attackType: string;
  decision: 'allow' | 'block';
  reason?: string;
  filterRuleId?: string;
  latencyMs: number;
  timestamp: string;
}

// ─── persisted run + corpus types (gateway API shape) ────────────────────────
//
// PACT-465 repoints Test Lab's "Save to corpus" and run-history save/list
// onto the gateway's POST /v1/benchmark/corpus and GET+POST
// /v1/benchmark/testlab/runs (schema/benchmark, pulled from pact-gateway).
// The gateway resolves the actor from the session server-side -- callers
// never send an actor, unlike the retired X-Pact-Actor direct-proxy path.
// The generated wire types are re-exported under the domain vocabulary the
// Test Lab UI already used pre-migration.
export type TestLabRunRecord = BenchmarkTestLabRunBody;
export type SaveRunPayload = BenchmarkSaveTestLabRunRequest;
export type SaveCorpusPayload = BenchmarkSaveCorpusRequest;

export const toTestRun = (r: TestLabRunRecord): TestRun => ({
  id: r.id,
  input: r.content,
  attackType: r.attack_type,
  decision: r.decision as 'allow' | 'block',
  reason: r.reason || undefined,
  filterRuleId: r.filter_rule_id || undefined,
  latencyMs: r.latency_ms,
  timestamp: new Date(r.created_at * 1000).toISOString(),
});

// ─── pipeline constants ───────────────────────────────────────────────────────

// Attack examples are fetched via useTestLabCorpusExamples (see
// use_test_lab_corpus_examples.ts and
// app/api/pact/benchmark/v1/corpus/examples/route.ts).
// Custom is the only static chip — it has no pre-filled example.
export const STATIC_CHIPS: AttackChip[] = [
  { id: 'custom', label: 'Custom', example: '' },
];

// LayerDefinition is the single source of truth for which pipeline stages the
// Test Lab visualises, in display order. BLANK_LAYERS and the stage count
// used elsewhere (e.g. TestLabPipelineCard's rendering) derive from this list
// rather than hard-coding the current two stages.
export interface LayerDefinition {
  id: string;
  label: string;
}

export const LAYER_DEFINITIONS: LayerDefinition[] = [
  { id: 'filter', label: 'Filter' },
  { id: 'classifier', label: 'Classifier' },
];

export const BLANK_LAYERS: LayerState[] = LAYER_DEFINITIONS.map((def) => ({
  ...def,
  decision: 'pending' as LayerDecision,
}));

// ─── layer inference (mock path) ──────────────────────────────────────────────
// Used when the gateway returns _mock_layers (dev:mock only).

// Matches mock layers onto pipeline stages by MockLayer.name (which the mock
// handler always sets to the stage id, e.g. 'filter'/'classifier') rather
// than array position, so the mapping stays correct even if the mock payload
// omits a stage or returns them out of order.
export const applyMockLayers = (
  prev: LayerState[],
  mockLayers: MockLayer[],
  bypassLayers: string[]
): LayerState[] =>
  prev.map((l) => {
    if (bypassLayers.includes(l.id)) return l;
    const ml = mockLayers.find((m) => m.name === l.id);
    if (!ml) return { ...l, decision: 'skip' as LayerDecision };

    return {
      ...l,
      decision: ml.decision as LayerDecision,
      ruleId: ml.rule_id,
      reason: ml.reason,
      latencyMs: ml.latency_ms,
      confidence: ml.confidence,
      classifierLabel: ml.label,
      bypassed: false,
    };
  });

// ─── layer inference (live path) ──────────────────────────────────────────────
// Used when talking to the real gateway. PACT-249 added structural sub-objects
// (`filter`, `redactor`) to /v1/check. PACT-252 swaps this function over to
// consume them. Precedence inside `filterBlocked`:
//
//   1. structural — `data.filter.verdict === 'hostile' && !data.filter.shadow`
//   2. legacy fallback — `filter_rule_id` set AND gateway decision is block
//   3. legacy fallback — `reason === 'filter_hostile'`
//
// The `reason` value is still surfaced as the human-readable explanation but
// never used as a control-flow gate where a structural equivalent exists.
// Classifier signalling (`classifier_unreachable`, `classifier_tagged`) is
// untouched — PACT-249 didn't add a structural equivalent on the classifier
// side, so the reason match stays as the canonical signal there.

const filterRuleId = (data: CheckResponse): string | undefined =>
  data.filter?.rule_id || data.filter_rule_id || undefined;

const filterShadow = (data: CheckResponse): boolean =>
  Boolean(data.filter?.shadow);

const filterBlocked = (data: CheckResponse): boolean => {
  if (data.filter?.verdict === 'hostile' && !data.filter.shadow) return true;
  // The structural sub-object is authoritative when present — any non-hostile
  // verdict (incl. safe/suspicious + shadow-hostile) means filter did NOT block.
  if (data.filter?.verdict) return false;
  // Back-compat for gateway builds older than PACT-249.
  if (data.filter_rule_id) return data.decision === 'block';

  return data.reason === 'filter_hostile';
};

const classifierUnreachable = (data: CheckResponse): boolean =>
  data.reason === 'classifier_unreachable';

const classifierResponded = (data: CheckResponse): boolean =>
  Boolean(data.classifier?.label);

const filterReason = (data: CheckResponse): string | undefined => {
  const ruleId = filterRuleId(data);
  // A shadow match never blocks but is worth surfacing on the filter layer
  // so reviewers can see which dry-run rule fired during a Test Lab run.
  if (filterShadow(data) && ruleId) {
    return `Shadow rule ${ruleId} matched (not enforced)`;
  }
  if (!filterBlocked(data)) return undefined;
  if (ruleId) return `Matched rule ${ruleId}`;

  return data.reason || 'Filter matched';
};

const classifierReason = (
  data: CheckResponse,
  blocked: boolean
): string | undefined => {
  if (classifierUnreachable(data)) return 'Classifier unreachable — fail open';
  if (!classifierResponded(data)) return undefined;
  if (blocked) return data.reason || 'Blocked by classifier';
  if (data.reason === 'classifier_tagged') return 'Tagged by classifier';

  return undefined;
};

export const applyLiveLayers = (
  prev: LayerState[],
  data: CheckResponse,
  bypassLayers: string[]
): LayerState[] => {
  const filterDidBlock = filterBlocked(data);

  return prev.map((l) => {
    if (bypassLayers.includes(l.id)) return l;

    if (l.id === 'filter') {
      return {
        ...l,
        decision: (filterDidBlock ? 'block' : 'allow') as LayerDecision,
        ruleId: filterRuleId(data),
        reason: filterReason(data),
        latencyMs: undefined,
        confidence: undefined,
        classifierLabel: undefined,
        bypassed: false,
      };
    }

    // classifier
    if (filterDidBlock) {
      return {
        ...l,
        decision: 'skip' as LayerDecision,
        reason: 'Skipped — filter blocked',
        ruleId: undefined,
        latencyMs: undefined,
        confidence: undefined,
        classifierLabel: undefined,
        bypassed: false,
      };
    }
    if (classifierUnreachable(data)) {
      return {
        ...l,
        decision: 'skip' as LayerDecision,
        reason: classifierReason(data, false),
        ruleId: undefined,
        latencyMs: undefined,
        confidence: undefined,
        classifierLabel: undefined,
        bypassed: false,
      };
    }

    // Only attribute a block to the classifier when the classifier actually
    // labelled the content. A block decision without a classifier label
    // means it came from a downstream stage (policy / consensus) — those
    // aren't visualised today, so classifier reads "allow" with whatever
    // diagnostic the classifier itself returned.
    const classifierBlocked =
      data.decision === 'block' && !filterDidBlock && classifierResponded(data);

    return {
      ...l,
      decision: (classifierBlocked ? 'block' : 'allow') as LayerDecision,
      reason: classifierReason(data, classifierBlocked),
      ruleId: undefined,
      latencyMs: undefined,
      confidence: data.classifier?.score,
      classifierLabel: data.classifier?.label,
      bypassed: false,
    };
  });
};

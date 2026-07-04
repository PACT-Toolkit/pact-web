import {
  type BenchmarkSaveCorpusRequest,
  type BenchmarkSaveTestLabRunRequest,
  type BenchmarkTestLabRunBody,
} from '@/src/__codegen__/rest/benchmark';
import {
  type CheckCheckRequest,
  type CheckCheckResponse,
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
// CheckResponse refines the generated `decision` string to the closed
// allow/block union the layer-inference relies on, and adds the mock-only
// `_mock_layers` escape hatch. dev:mock returns _mock_layers to drive the
// pipeline animation; the real gateway never emits it.
export type CheckResponse = Omit<CheckCheckResponse, 'decision'> & {
  decision: 'allow' | 'block';
  _mock_layers?: MockLayer[];
};

// CheckInput is the /v1/check request body plus the mock-only `_bypass_layers`
// hint that lets the Test Lab re-run with a stage skipped (dev:mock reads it;
// the real gateway ignores unknown fields).
export type CheckInput = CheckCheckRequest & { _bypass_layers?: string[] };

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

// Attack examples are fetched from GET /api/pact/benchmark/v1/corpus/examples
// (see app/api/pact/benchmark/v1/corpus/examples/route.ts).
// Custom is the only static chip — it has no pre-filled example.
export const STATIC_CHIPS: AttackChip[] = [
  { id: 'custom', label: 'Custom', example: '' },
];

export const BLANK_LAYERS: LayerState[] = [
  { id: 'filter', label: 'Filter', decision: 'pending' },
  { id: 'classifier', label: 'Classifier', decision: 'pending' },
];

// ─── layer inference (mock path) ──────────────────────────────────────────────
// Used when the gateway returns _mock_layers (dev:mock only).

export const applyMockLayers = (
  prev: LayerState[],
  mockLayers: MockLayer[],
  bypassLayers: string[]
): LayerState[] =>
  prev.map((l, i) => {
    if (bypassLayers.includes(l.id)) return l;
    const ml = mockLayers[i];
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

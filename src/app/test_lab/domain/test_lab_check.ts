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

export interface CheckResponse {
  request_id: string;
  decision: 'allow' | 'block';
  reason?: string;
  filter_rule_id?: string;
  latency_ms: number;
  classifier?: { label?: string; score?: number };
  _mock_layers?: MockLayer[];
}

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

// ─── persisted run types (API shape) ─────────────────────────────────────────

export interface TestLabRunRecord {
  id: string;
  content: string;
  attack_type: string;
  decision: 'allow' | 'block';
  reason: string;
  filter_rule_id: string;
  latency_ms: number;
  request_id: string;
  created_at: number; // Unix seconds (UTC)
}

export interface TestLabRunsResponse {
  runs: TestLabRunRecord[];
  total: number;
}

export interface SaveRunPayload {
  content: string;
  attack_type: string;
  decision: 'allow' | 'block';
  reason: string;
  filter_rule_id: string;
  latency_ms: number;
  request_id: string;
}

export const toTestRun = (r: TestLabRunRecord): TestRun => ({
  id: r.id,
  input: r.content,
  attackType: r.attack_type,
  decision: r.decision,
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
// Used when talking to the real gateway. Per the current /v1/check response
// shape (pact-gateway/internal/features/check/types.go), only the top-level
// decision, reason code, optional filter_rule_id, and optional classifier
// {label, score} are exposed — individual stage verdicts aren't structured.
//
// Hardening (PACT-230): infer layer state from *structural* signals
// (non-empty filter_rule_id, presence of classifier.label) rather than
// string-matching the `reason` field, which is documentary, not contractual.
// The `reason` value is still surfaced as the human-readable explanation but
// never used as a control-flow gate. When PACT-249 lands and the response
// carries explicit per-stage verdicts, this function collapses to a direct
// projection of those fields.

const filterBlocked = (data: CheckResponse): boolean =>
  Boolean(data.filter_rule_id) || data.reason === 'filter_hostile';

const classifierUnreachable = (data: CheckResponse): boolean =>
  data.reason === 'classifier_unreachable';

const classifierResponded = (data: CheckResponse): boolean =>
  Boolean(data.classifier?.label);

const filterReason = (data: CheckResponse): string | undefined => {
  if (!filterBlocked(data)) return undefined;
  if (data.filter_rule_id) return `Matched rule ${data.filter_rule_id}`;

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
        ruleId: data.filter_rule_id || undefined,
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

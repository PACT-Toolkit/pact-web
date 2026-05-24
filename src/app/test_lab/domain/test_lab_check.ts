import { type AttackChip, type LayerDecision, type LayerState } from '@/src/app/test_lab/ui/types';

// ─── API payload types ────────────────────────────────────────────────────────

export interface MockLayer {
  name: string;
  decision: string;
  rule_id?: string;
  reason?: string;
  latency_ms?: number;
  confidence?: number;
}

export interface CheckResponse {
  request_id: string;
  decision: 'allow' | 'block';
  reason?: string;
  filter_rule_id?: string;
  latency_ms: number;
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

// ─── pipeline constants ───────────────────────────────────────────────────────

export const STATIC_CHIPS: AttackChip[] = [
  { id: 'indirect', label: 'File Embed', example: '' },
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
  bypassLayers: string[],
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
      bypassed: false,
    };
  });

// ─── layer inference (live path) ──────────────────────────────────────────────
// Used when talking to the real gateway — infers layer states from top-level
// decision + reason code since individual stage results aren't returned.

export const applyLiveLayers = (
  prev: LayerState[],
  data: CheckResponse,
  bypassLayers: string[],
): LayerState[] =>
  prev.map(l => {
    if (bypassLayers.includes(l.id)) return l;

    if (l.id === 'filter') {
      return data.reason === 'filter_hostile'
        ? { ...l, decision: 'block' as LayerDecision, ruleId: data.filter_rule_id, reason: 'Filter matched rule', bypassed: false }
        : { ...l, decision: 'allow' as LayerDecision, reason: undefined, ruleId: undefined, bypassed: false };
    }

    // classifier
    if (data.reason === 'filter_hostile') {
      return { ...l, decision: 'skip' as LayerDecision, reason: 'Skipped — filter blocked', bypassed: false };
    }
    if (data.reason === 'classifier_unreachable') {
      return { ...l, decision: 'skip' as LayerDecision, reason: 'Classifier unreachable — fail open', bypassed: false };
    }
    if (data.reason === 'policy_token_denied') {
      return { ...l, decision: 'allow' as LayerDecision, reason: undefined, bypassed: false };
    }
    if (data.reason === 'classifier_tagged') {
      return { ...l, decision: 'allow' as LayerDecision, reason: 'Tagged by classifier', bypassed: false };
    }

    return data.decision === 'block'
      ? { ...l, decision: 'block' as LayerDecision, reason: data.reason, bypassed: false }
      : { ...l, decision: 'allow' as LayerDecision, reason: undefined, bypassed: false };
  });

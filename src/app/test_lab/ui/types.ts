export type LayerDecision = 'allow' | 'block' | 'skip' | 'pending';

export type RunStatus = 'idle' | 'running' | 'done' | 'error';

export interface AttackChip {
  id: string;
  label: string;
  example: string;
}

export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// PipelineResult is TestLabPipelineCard's collapsed view of the /v1/check
// result it renders on the Result node -- visual-state shape, not the wire
// CheckResponse itself.
export interface PipelineResult {
  decision: 'allow' | 'block';
  latencyMs: number;
  reason?: string;
  // Causal-replay diagnostics (PACT-745/PACT-757) for a block that cannot be
  // attributed to any one visualised stage (cel_rule_fired,
  // policy_token_denied). Same offset-range-only shape as
  // LayerState.causalSpans -- see that field's comment for why text is never
  // included.
  causalSpans?: { start?: number; end?: number }[];
}

export interface LayerState {
  id: string;
  label: string;
  decision: LayerDecision;
  ruleId?: string;
  reason?: string;
  latencyMs?: number;
  confidence?: number;
  classifierLabel?: string;
  bypassed?: boolean;
  // Redactor layer detail (PACT-703) -- populated only when this layer is
  // the redactor stage and it produced a 'redacted' verdict.
  redactedSpanCount?: number;
  redactedSpanLabels?: string[];
  // Sandbox layer detail (PACT-703) -- populated only when this layer is the
  // conditionally-rendered sandbox stage (data.external_refs present).
  refsScanned?: number;
  refsBlocked?: number;
  refsMitigated?: number;
  // Causal-replay diagnostics (PACT-745, wire field diagnostics.causal_spans
  // -- PACT-734/735). Populated only on the layer that actually blocked the
  // request; text is deliberately never included (PII avoidance), so this is
  // offset ranges only, same as the wire shape.
  causalSpans?: { start?: number; end?: number }[];
}

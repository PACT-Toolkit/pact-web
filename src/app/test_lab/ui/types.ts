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
}

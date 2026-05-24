export type LayerDecision = 'allow' | 'block' | 'skip' | 'pending';

export type RunStatus = 'idle' | 'running' | 'done' | 'error';

export interface AttackChip {
  id: string;
  label: string;
  example: string;
}


export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export interface LayerState {
  id: string;
  label: string;
  decision: LayerDecision;
  ruleId?: string;
  reason?: string;
  latencyMs?: number;
  confidence?: number;
  bypassed?: boolean;
}

import { Database } from 'lucide-react';

import  { type SaveState } from '@/src/app/test_lab/ui/types';

export const TestLabResultNode = ({
  decision,
  latency,
  reason,
  onSave,
  saveState,
}: {
  decision?: 'allow' | 'block';
  latency?: number;
  reason?: string;
  onSave: () => void;
  saveState: SaveState;
}) => (
  <div
    className={`flex w-32 shrink-0 flex-col gap-1.5 rounded-lg border-2 p-3 transition-all duration-500 ${
      decision === 'block'
        ? 'border-destructive bg-destructive/5'
        : decision === 'allow'
          ? 'border-green-500/40 bg-green-500/5'
          : 'border-border opacity-40'
    }`}
  >
    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      Result
    </span>
    {decision && (
      <span
        className={`text-sm font-bold ${
          decision === 'block' ? 'text-destructive' : 'text-green-600 dark:text-green-400'
        }`}
      >
        {decision.toUpperCase()}
      </span>
    )}
    {reason && (
      <span className="break-all font-mono text-xs text-muted-foreground">{reason}</span>
    )}
    {latency !== undefined && (
      <span className="text-xs text-muted-foreground">{latency}ms total</span>
    )}
    {decision === 'block' && (
      <button
        type="button"
        onClick={onSave}
        disabled={saveState === 'saving' || saveState === 'saved'}
        className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
      >
        <Database className="h-3 w-3" />
        {saveState === 'saved'
          ? 'Saved!'
          : saveState === 'saving'
            ? 'Saving…'
            : saveState === 'error'
              ? 'Failed — retry?'
              : 'Save to corpus'}
      </button>
    )}
  </div>
);

'use client';

import { useState } from 'react';

import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';

interface BenchmarkImportScoreThresholdProps {
  scoreColumn: string;
  /** The committed threshold currently applied to the preview. */
  threshold: number;
  /** True while the threshold is the server's suggestion, not a user choice. */
  autoDetected: boolean;
  /** Sampled rows at or above / below the effective threshold. */
  blockRows: number;
  allowRows: number;
  sampledRows: number;
  /** True while a preview refetch for the committed threshold is in flight. */
  busy: boolean;
  onCommit: (threshold: number) => void;
}

/**
 * Threshold control for datasets labelled by a numeric score column. Typing
 * edits a local draft; only blur or Enter commits, so one edit triggers one
 * preview refetch rather than one per keystroke.
 */
export const BenchmarkImportScoreThreshold = ({
  scoreColumn,
  threshold,
  autoDetected,
  blockRows,
  allowRows,
  sampledRows,
  busy,
  onCommit,
}: BenchmarkImportScoreThresholdProps) => {
  const [draft, setDraft] = useState<string | null>(null);

  const commit = () => {
    if (draft === null) return;

    const parsed = draft.trim() === '' ? Number.NaN : Number(draft);
    setDraft(null);
    if (Number.isFinite(parsed) && parsed !== threshold) onCommit(parsed);
  };

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor="benchmark-import-score-threshold">
        Score column <span className="font-mono text-xs">{scoreColumn}</span>{' '}
        detected - rows at or above the threshold count as attacks{' '}
        {autoDetected && (
          <span
            className="text-xs font-normal text-muted-foreground"
            data-testid="benchmark-import-score-threshold-auto"
          >
            Auto-detected
          </span>
        )}
      </Label>
      <Input
        id="benchmark-import-score-threshold"
        type="number"
        step="any"
        inputMode="decimal"
        className="w-32"
        value={draft ?? String(threshold)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          commit();
        }}
        data-testid="benchmark-import-score-threshold"
      />
      <p
        className="text-xs text-muted-foreground"
        aria-busy={busy}
        data-testid="benchmark-import-score-split"
      >
        {blockRows.toLocaleString()} rows at or above -&gt; attack,{' '}
        {allowRows.toLocaleString()} below -&gt; benign (of{' '}
        {sampledRows.toLocaleString()} sampled)
      </p>
    </div>
  );
};

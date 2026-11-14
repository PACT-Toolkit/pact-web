'use client';

import { useState } from 'react';

import { rowPromptDisplay } from '@/src/app/benchmark/domain/benchmark_run_rows';
import { cn } from '@/src/lib/utils';

interface BenchmarkRunRowPromptProps {
  contentPreview: string | undefined;
}

/**
 * The prompt a run row judged: clamped to two lines, the full preview on hover
 * (title) and behind a keyboard-reachable toggle. Plain text only.
 */
export const BenchmarkRunRowPrompt = ({
  contentPreview,
}: BenchmarkRunRowPromptProps) => {
  const [expanded, setExpanded] = useState(false);
  const display = rowPromptDisplay(contentPreview);

  if (display.kind === 'missing') {
    return (
      <span
        className="text-xs italic text-muted-foreground"
        title={display.explanation}
        data-testid="benchmark-run-rows-prompt-missing"
      >
        <span aria-hidden="true">{display.label}</span>
        <span className="sr-only">{display.explanation}</span>
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <p
        className={cn(
          'whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]',
          !expanded && 'line-clamp-2'
        )}
        title={display.text}
        data-testid="benchmark-run-rows-prompt"
      >
        {display.text}
      </p>
      {display.expandable && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="text-xs text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2"
          data-testid="benchmark-run-rows-prompt-toggle"
        >
          {expanded ? 'Show less' : 'Show full preview'}
        </button>
      )}
    </div>
  );
};

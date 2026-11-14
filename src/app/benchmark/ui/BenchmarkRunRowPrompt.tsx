'use client';

import { useLayoutEffect, useRef, useState } from 'react';

import { rowPromptDisplay } from '@/src/app/benchmark/domain/benchmark_run_rows';
import { cn } from '@/src/lib/utils';

interface BenchmarkRunRowPromptProps {
  contentPreview: string | undefined;
}

/**
 * The prompt a run row judged: clamped to two lines, the full preview on hover
 * (title) and behind a keyboard-reachable toggle. The toggle appears only when
 * the text is really clamped, which depends on the column width and glyphs, so
 * it is measured, not guessed from the length. Plain text only.
 */
export const BenchmarkRunRowPrompt = ({
  contentPreview,
}: BenchmarkRunRowPromptProps) => {
  const [expanded, setExpanded] = useState(false);
  const [isClamped, setIsClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const display = rowPromptDisplay(contentPreview);

  // Re-measure while collapsed (text or column width changed). Expanded text
  // is never clamped, so the last collapsed result is kept and the toggle
  // stays to collapse again.
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || expanded) return;

    const measure = () => setIsClamped(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(el);

    return () => observer.disconnect();
  }, [expanded, contentPreview]);

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
        ref={textRef}
        className={cn(
          'whitespace-pre-wrap break-words text-xs [overflow-wrap:anywhere]',
          !expanded && 'line-clamp-2'
        )}
        title={display.text}
        data-testid="benchmark-run-rows-prompt"
      >
        {display.text}
      </p>
      {(isClamped || expanded) && (
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

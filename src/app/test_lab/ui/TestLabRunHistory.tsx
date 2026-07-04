'use client';

import { Check, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { useState } from 'react';

import { type TestRun } from '@/src/app/test_lab/domain/test_lab_check';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// How long the copy button shows its confirmed (check) state before
// reverting to the copy icon.
const COPY_FEEDBACK_MS = 1500;

const TestLabRunRow = ({ run }: { run: TestRun }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(run.input);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard can reject (insecure context / permissions). Swallow —
      // a failed copy shouldn't surface an error in a read-only history list.
    }
  };

  return (
    <div className="flex flex-col text-xs" data-testid="test-lab-run-row">
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          aria-expanded={open}
          aria-label={open ? 'Collapse prompt' : 'Expand prompt'}
        >
          {open ? (
            <ChevronUp
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          ) : (
            <ChevronDown
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-hidden
            />
          )}
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 font-mono font-semibold ${
              run.decision === 'block'
                ? 'bg-destructive/10 text-destructive'
                : 'bg-green-500/10 text-green-600 dark:text-green-400'
            }`}
          >
            {run.decision.toUpperCase()}
          </span>
          {run.reason && (
            <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {run.reason}
            </code>
          )}
          {run.filterRuleId && (
            <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-muted-foreground">
              {run.filterRuleId}
            </code>
          )}
          {!open && (
            <span
              data-testid="test-lab-run-row-input"
              className="min-w-0 flex-1 truncate font-mono text-muted-foreground"
            >
              {run.input}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={onCopy}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
          title={copied ? 'Copied' : 'Copy prompt'}
        >
          {copied ? (
            <Check
              className="h-3.5 w-3.5 text-green-600 dark:text-green-400"
              aria-hidden
            />
          ) : (
            <Copy className="h-3.5 w-3.5" aria-hidden />
          )}
        </button>
        <span className="shrink-0 text-muted-foreground">
          {run.latencyMs}ms
        </span>
        <span className="shrink-0 text-muted-foreground">
          {new Date(run.timestamp).toLocaleTimeString()}
        </span>
      </div>
      {open && (
        <div className="flex flex-col gap-1 px-4 pb-3 pl-[2.6rem]">
          {run.attackType && (
            <span className="text-muted-foreground">
              Attack type:{' '}
              <code className="rounded bg-muted px-1.5 py-0.5">
                {run.attackType}
              </code>
            </span>
          )}
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words rounded-md border bg-muted/40 p-3 font-mono text-xs">
            {run.input}
          </pre>
        </div>
      )}
    </div>
  );
};

export const TestLabRunHistory = ({ history }: { history: TestRun[] }) => (
  <Card data-testid="test-lab-run-history">
    <CardHeader className="pb-3">
      <CardTitle className="text-base">Test Run History</CardTitle>
      <CardDescription>
        Persisted gateway verdicts. Overrides are not reflected here.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex flex-col divide-y rounded-md border">
        {history.map((run) => (
          <TestLabRunRow key={run.id} run={run} />
        ))}
      </div>
    </CardContent>
  </Card>
);

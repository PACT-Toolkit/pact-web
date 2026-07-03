'use client';

import { Eraser, Play } from 'lucide-react';
import { useState } from 'react';

import { useCheckContent } from '@/src/__codegen__/rest/check';
import { applyRedaction } from '@/src/app/redactor/domain/redactor_redaction';
import { RedactorSpanList } from '@/src/app/redactor/ui/RedactorSpanList';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// Ad-hoc redaction test panel (PACT-324): paste text, run it through the
// real pipeline via /v1/check with kind "output" (the direction the
// redactor stage is most commonly exercised against -- masking sensitive
// content before it leaves the pipeline), and render the masked preview
// plus the span table the gateway reported.
//
// Uses the generated useCheckContent SWR-mutation hook for the request
// (satisfies the "writes go through useSWRMutation" rule) rather than
// re-deriving request/response handling -- the request/response contract
// itself (CheckCheckRequest/CheckCheckResponse, kind, redactor.spans) is
// the same one Test Lab's checkContent() calls and DashboardQuickProbe
// consume (see test_lab_check.ts / DashboardQuickProbe.tsx); this panel has
// no layer-pipeline animation or bypass-layer concept to reuse from Test
// Lab beyond that shared contract.
export const RedactorTestPanel = () => {
  const [content, setContent] = useState('');
  const { trigger, data, error, isMutating } = useCheckContent();

  const result = data?.status === 200 ? data.data : undefined;
  const requestFailed =
    Boolean(error) || (data !== undefined && data.status !== 200);

  const runTest = () => {
    if (!content.trim()) return;
    void trigger({ content, kind: 'output' });
  };

  const spans = result?.redactor?.spans ?? [];
  const masked = result ? applyRedaction(content, result.redactor?.spans) : '';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eraser className="h-4 w-4" aria-hidden />
          Ad-hoc redaction test
        </CardTitle>
        <CardDescription>
          Paste text and run it through the redactor stage via /v1/check (kind:
          output). Renders the masked preview and the PII spans the gateway
          reported.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runTest();
          }}
          placeholder="Paste text to check for PII, e.g. Contact me at jane@example.com or 555-123-4567."
          rows={4}
          data-testid="redactor-test-input"
          className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:outline-none"
        />

        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={runTest}
            disabled={!content.trim() || isMutating}
            data-testid="redactor-test-run"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {isMutating ? 'Running…' : 'Run test'}
          </Button>
          <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter</span>
          {requestFailed && (
            <span
              className="text-xs text-destructive"
              data-testid="redactor-test-error"
            >
              Request failed. Is pact-gateway running?
            </span>
          )}
        </div>

        {result && !requestFailed && (
          <div
            className="flex flex-col gap-3 border-t pt-3"
            data-testid="redactor-test-result"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                  result.redactor?.verdict === 'redacted'
                    ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300'
                    : 'bg-green-500/10 text-green-600 dark:text-green-400'
                }`}
              >
                {result.redactor?.verdict ?? 'unknown'}
              </span>
              <span className="text-xs text-muted-foreground">
                {spans.length} span{spans.length === 1 ? '' : 's'}
              </span>
              <span className="text-xs text-muted-foreground">
                {result.latency_ms} ms
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-muted-foreground">
                Masked output
              </p>
              <pre
                className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-3 font-mono text-xs"
                data-testid="redactor-test-masked-output"
              >
                {masked || '(empty)'}
              </pre>
            </div>

            {spans.length > 0 && <RedactorSpanList spans={spans} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

'use client';

import { Play, Radar } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';

import { useCheckContent } from '@/src/__codegen__/rest/check';
import {
  buildDiagnosticsProbeRequest,
  causalSpansToHighlights,
  DIAGNOSTICS_PROBE_CONTENT,
} from '@/src/app/gateway/domain/gateway_diagnostics';
import { useGatewayConfig } from '@/src/app/gateway/domain/use_gateway_config';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// causal-span replay renders the submitted content with each replayed span
// highlighted, so an operator can see exactly which substring the
// counterfactual-replay harness attributes the block decision to.
const ContentReplay = ({
  content,
  highlights,
}: {
  content: string;
  highlights: { start: number; end: number; text: string }[];
}) => {
  if (highlights.length === 0) {
    return <p className="font-mono text-xs">{content}</p>;
  }

  const parts: ReactNode[] = [];
  let cursor = 0;

  highlights.forEach((h, i) => {
    if (h.start > cursor) parts.push(content.slice(cursor, h.start));
    parts.push(
      <mark
        key={i}
        className="rounded bg-destructive/20 px-0.5 text-destructive"
        data-testid="gateway-diagnostics-span"
      >
        {h.text}
      </mark>
    );
    cursor = h.end;
  });
  if (cursor < content.length) parts.push(content.slice(cursor));

  return (
    <p className="font-mono text-xs">
      {parts.map((part, i) => (
        <Fragment key={i}>{part}</Fragment>
      ))}
    </p>
  );
};

// Ad-hoc diagnostics / causal-span replay probe (PACT-303 causal-diagnostic
// harness, PACT-327 console). Sourced live from POST /v1/check's
// diagnostics.causal_spans -- there is no historical equivalent, see
// gateway_diagnostics.ts's docblock (pact-gateway explicitly does not mirror
// this field onto the pact.decisions audit event).
export const GatewayDiagnosticsPanel = () => {
  const { config, isLoading: configLoading } = useGatewayConfig();
  const { trigger: runCheck, data, error, isMutating } = useCheckContent();

  const result = data?.status === 200 ? data.data : undefined;
  const requestFailed =
    Boolean(error) || (data !== undefined && data.status !== 200);

  const diagnosticsEnabled = Boolean(config?.diagnosticsEnabled);
  const spans = result?.diagnostics?.causal_spans;
  const highlights = causalSpansToHighlights(DIAGNOSTICS_PROBE_CONTENT, spans);

  const runProbe = () => {
    void runCheck(buildDiagnosticsProbeRequest());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Radar className="h-4 w-4" aria-hidden />
          Diagnostics
        </CardTitle>
        <CardDescription>
          Counterfactual causal-span replay: which part of the content caused a
          BLOCK decision. Runs on every block when enabled.
        </CardDescription>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-3"
        data-testid="gateway-diagnostics-panel"
      >
        {!configLoading && !diagnosticsEnabled && (
          <p
            className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="gateway-diagnostics-disabled"
          >
            Diagnostics disabled. The gateway build running today does not run
            the causal-diagnostic harness, so blocked requests carry no
            causal_spans.
          </p>
        )}

        {!configLoading && diagnosticsEnabled && (
          <>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={runProbe}
                disabled={isMutating}
                data-testid="gateway-diagnostics-run"
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                {isMutating ? 'Running…' : 'Run diagnostics probe'}
              </Button>
              {requestFailed && (
                <span
                  className="text-xs text-destructive"
                  data-testid="gateway-diagnostics-error"
                >
                  Request failed. Is pact-gateway running?
                </span>
              )}
            </div>

            {result && !requestFailed && (
              <div
                className="flex flex-col gap-3 border-t pt-3"
                data-testid="gateway-diagnostics-result"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${
                      result.decision === 'block'
                        ? 'bg-destructive/10 text-destructive'
                        : 'bg-green-500/10 text-green-600 dark:text-green-400'
                    }`}
                  >
                    {result.decision.toUpperCase()}
                  </span>
                  {result.reason && (
                    <span className="text-xs text-muted-foreground">
                      {result.reason}
                    </span>
                  )}
                </div>

                {result.decision === 'block' ? (
                  <div className="rounded-md border bg-muted/20 p-3">
                    <ContentReplay
                      content={DIAGNOSTICS_PROBE_CONTENT}
                      highlights={highlights}
                    />
                  </div>
                ) : (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="gateway-diagnostics-no-block"
                  >
                    This probe allowed -- the causal-diagnostic harness only
                    replays block decisions.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

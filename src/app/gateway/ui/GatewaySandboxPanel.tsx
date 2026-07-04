'use client';

import { Play, ShieldAlert } from 'lucide-react';

import { useCheckContent } from '@/src/__codegen__/rest/check';
import {
  buildSandboxProbeRequest,
  verdictBadgeClass,
} from '@/src/app/gateway/domain/gateway_sandbox';
import { useGatewayConfig } from '@/src/app/gateway/domain/use_gateway_config';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// Ad-hoc sandbox / indirect-injection probe (PACT-236 re-scan, PACT-327
// console). Sourced live from POST /v1/check's external_refs response, not
// the pact.decisions audit feed -- see gateway_sandbox.ts's docblock for why
// (the audit event deliberately excludes purified_content). Same
// ad-hoc-test-panel shape as ClassifierTestPanel/RedactorTestPanel.
export const GatewaySandboxPanel = () => {
  const { config, isLoading: configLoading } = useGatewayConfig();
  const { trigger: runCheck, data, error, isMutating } = useCheckContent();

  const result = data?.status === 200 ? data.data : undefined;
  const requestFailed =
    Boolean(error) || (data !== undefined && data.status !== 200);
  const info = result?.external_refs;

  const sandboxEnabled = Boolean(config?.sandboxEnabled);

  const runProbe = () => {
    void runCheck(buildSandboxProbeRequest());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4" aria-hidden />
          Sandbox / indirect-injection
        </CardTitle>
        <CardDescription>
          Fetches and re-scans third-party references (external_refs) in an
          isolated worker before the caller passes them to its LLM.
        </CardDescription>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-3"
        data-testid="gateway-sandbox-panel"
      >
        {!configLoading && !sandboxEnabled && (
          <p
            className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground"
            data-testid="gateway-sandbox-disabled"
          >
            Sandbox disabled (SANDBOX_ENABLED=false). external_refs are not
            fetched or re-scanned -- requests pass through unscanned.
          </p>
        )}

        {!configLoading && sandboxEnabled && (
          <>
            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={runProbe}
                disabled={isMutating}
                data-testid="gateway-sandbox-run"
              >
                <Play className="h-3.5 w-3.5" aria-hidden />
                {isMutating ? 'Running…' : 'Run sandbox probe'}
              </Button>
              {requestFailed && (
                <span
                  className="text-xs text-destructive"
                  data-testid="gateway-sandbox-error"
                >
                  Request failed. Is pact-gateway running?
                </span>
              )}
            </div>

            {result && !requestFailed && (
              <div
                className="flex flex-col gap-3 border-t pt-3"
                data-testid="gateway-sandbox-result"
              >
                {info ? (
                  <>
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-3">
                      <div className="flex flex-col gap-1 rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">
                          Scanned
                        </span>
                        <span className="text-lg font-semibold tabular-nums">
                          {info.scanned}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">
                          Blocked
                        </span>
                        <span className="text-lg font-semibold tabular-nums text-destructive">
                          {info.blocked}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 rounded-lg border p-3">
                        <span className="text-xs text-muted-foreground">
                          Mitigated
                        </span>
                        <span className="text-lg font-semibold tabular-nums">
                          {info.mitigated ?? 0}
                        </span>
                      </div>
                    </div>

                    <div
                      className="flex flex-col divide-y rounded-md border text-sm"
                      data-testid="gateway-sandbox-refs"
                    >
                      {(info.refs ?? []).map((ref, i) => (
                        <div
                          key={`${ref.host}-${i}`}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3"
                          data-testid="gateway-sandbox-ref-row"
                        >
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${verdictBadgeClass(ref.verdict)}`}
                          >
                            {(ref.verdict ?? 'unknown').toUpperCase()}
                          </span>
                          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                            {ref.host}
                          </code>
                          <span className="text-xs text-muted-foreground">
                            {ref.source}
                          </span>
                          {ref.purified_content && (
                            <p className="w-full text-xs text-muted-foreground">
                              {ref.purified_content}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p
                    className="text-xs text-muted-foreground"
                    data-testid="gateway-sandbox-no-refs"
                  >
                    No external_refs were declared on this probe.
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

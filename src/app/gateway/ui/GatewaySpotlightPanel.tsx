'use client';

import { Play, Sparkles } from 'lucide-react';

import { useCheckContent } from '@/src/__codegen__/rest/check';
import { spotlightFormatLabel } from '@/src/app/gateway/domain/gateway_config';
import {
  buildSpotlightProbeRequest,
  trustBadgeClass,
} from '@/src/app/gateway/domain/gateway_spotlight';
import { useGatewayConfig } from '@/src/app/gateway/domain/use_gateway_config';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

// Ad-hoc spotlighting probe (PACT-327 console): shows how fetched/RAG/tool
// content gets marker-wrapped before LLM injection. Sourced live from POST
// /v1/check's spotlight response -- populated on the allow path only (the
// swagger contract), so this probe always uses benign content. No config
// gate exists for this section (spotlightFormat is a marker-style choice,
// not an enabled/disabled toggle); the current format is shown for context.
export const GatewaySpotlightPanel = () => {
  const { config } = useGatewayConfig();
  const { trigger: runCheck, data, error, isMutating } = useCheckContent();

  const result = data?.status === 200 ? data.data : undefined;
  const requestFailed =
    Boolean(error) || (data !== undefined && data.status !== 200);
  const spotlight = result?.spotlight;

  const runProbe = () => {
    void runCheck(buildSpotlightProbeRequest());
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-4 w-4" aria-hidden />
          Spotlighting
        </CardTitle>
        <CardDescription>
          Current format:{' '}
          <span className="font-medium">
            {spotlightFormatLabel(config?.spotlightFormat)}
          </span>
          . Third-party content is marker-wrapped before LLM injection so the
          host model can distinguish trusted instructions from fetched data.
        </CardDescription>
      </CardHeader>
      <CardContent
        className="flex flex-col gap-3"
        data-testid="gateway-spotlight-panel"
      >
        <div className="flex items-center gap-3">
          <Button
            size="sm"
            onClick={runProbe}
            disabled={isMutating}
            data-testid="gateway-spotlight-run"
          >
            <Play className="h-3.5 w-3.5" aria-hidden />
            {isMutating ? 'Running…' : 'Run spotlight probe'}
          </Button>
          {requestFailed && (
            <span
              className="text-xs text-destructive"
              data-testid="gateway-spotlight-error"
            >
              Request failed. Is pact-gateway running?
            </span>
          )}
        </div>

        {result && !requestFailed && (
          <div
            className="flex flex-col gap-3 border-t pt-3"
            data-testid="gateway-spotlight-result"
          >
            {spotlight ? (
              <>
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>
                    Format:{' '}
                    <span className="font-medium text-foreground">
                      {spotlight.format}
                    </span>
                  </span>
                  <span>
                    Sources:{' '}
                    <span className="font-medium text-foreground">
                      {spotlight.source_count}
                    </span>
                  </span>
                </div>

                <div
                  className="flex flex-col divide-y rounded-md border text-sm"
                  data-testid="gateway-spotlight-chunks"
                >
                  {(spotlight.chunks ?? []).map((chunk, i) => (
                    <div
                      key={`${chunk.source}-${i}`}
                      className="flex flex-col gap-1 px-4 py-3"
                      data-testid="gateway-spotlight-chunk-row"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${trustBadgeClass(chunk.trust)}`}
                        >
                          {(chunk.trust ?? 'unknown').toUpperCase()}
                        </span>
                        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                          {chunk.source}
                        </code>
                      </div>
                      <p className="font-mono text-xs break-all text-muted-foreground">
                        {chunk.wrapped}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p
                className="text-xs text-muted-foreground"
                data-testid="gateway-spotlight-no-chunks"
              >
                No spotlight_chunks were wrapped on this probe (only populated
                on the allow path).
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

'use client';

import { RefreshCw } from 'lucide-react';

import {
  consensusThresholdLabel,
  requestTimeoutLabel,
  sandboxIsolationLabel,
  spotlightFormatLabel,
} from '@/src/app/gateway/domain/gateway_config';
import { useGatewayConfig } from '@/src/app/gateway/domain/use_gateway_config';
import { GatewayEnforcementControls } from '@/src/app/gateway/ui/GatewayEnforcementControls';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

const InfoTile = ({ label, value }: { label: string; value: string }) => (
  <div className="flex flex-col gap-1 rounded-lg border p-4">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className="text-sm font-semibold tabular-nums">{value}</span>
  </div>
);

// Live view over GET /v1/config (pact-gateway PACT-320, PR #88): the
// enforcement posture that determines how the pipeline classifies and blocks
// traffic. Auth-gated, no secrets -- see gateway_config.ts's docblock. This
// is the section the other three /gateway sections (sandbox/diagnostics/
// spotlight) gate their disabled states on. Auto-refreshes every 15s so an
// operator who flips an env var and restarts the gateway sees it reflected
// here without a manual page reload.
//
// Classifier/vector enforce mode and consensus mode are live-writable via
// PACT-472's PATCH /v1/config/enforcement (PACT-473) -- see
// GatewayEnforcementControls for the segmented controls, optimistic write,
// and confirm-before-enforce flow. This override is not persisted: a
// gateway restart reverts to its env defaults, which the controls' footer
// text states explicitly.
export const GatewayEnforcementPanel = () => {
  const { config, error, isLoading, isValidating, mutate } = useGatewayConfig();

  return (
    <div
      className="flex flex-col gap-4"
      data-testid="gateway-enforcement-panel"
    >
      <Card>
        <CardHeader className="flex flex-col gap-1">
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <CardTitle>Enforcement posture</CardTitle>
              <CardDescription>
                Live pipeline configuration from GET /v1/config. Classifier,
                vector filter, and consensus mode are writable below via the
                gateway&apos;s runtime enforcement API.
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void mutate()}
              disabled={isValidating}
            >
              <RefreshCw
                className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`}
                aria-hidden
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              Failed to load gateway config. Try refreshing in a moment.
            </p>
          )}

          {isLoading && !error && (
            <p className="text-sm text-muted-foreground">
              Loading enforcement posture…
            </p>
          )}

          {config && !error && (
            <div
              className="grid grid-cols-2 gap-4 sm:grid-cols-4"
              data-testid="gateway-config-grid"
            >
              <GatewayEnforcementControls config={config} mutate={mutate} />
              <InfoTile
                label="Consensus threshold"
                value={consensusThresholdLabel(config.consensusThreshold)}
              />
              <InfoTile
                label="Request timeout"
                value={requestTimeoutLabel(config.requestTimeoutSeconds)}
              />
              <InfoTile
                label="Sandbox"
                value={config.sandboxEnabled ? 'Enabled' : 'Disabled'}
              />
              <InfoTile
                label="Sandbox isolation"
                value={sandboxIsolationLabel(config.sandboxIsolation)}
              />
              <InfoTile
                label="Diagnostics"
                value={config.diagnosticsEnabled ? 'Enabled' : 'Disabled'}
              />
              <InfoTile
                label="Spotlight format"
                value={spotlightFormatLabel(config.spotlightFormat)}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

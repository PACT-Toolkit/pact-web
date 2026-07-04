'use client';

import { RefreshCw } from 'lucide-react';

import {
  consensusThresholdLabel,
  enforceModeLabel,
  isEnforcing,
  requestTimeoutLabel,
  sandboxIsolationLabel,
  spotlightFormatLabel,
} from '@/src/app/gateway/domain/gateway_config';
import { useGatewayConfig } from '@/src/app/gateway/domain/use_gateway_config';
import { Button } from '@/src/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/src/components/ui/card';

const modeBadgeClass = (mode?: string): string =>
  isEnforcing(mode)
    ? 'bg-destructive/10 text-destructive'
    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400';

const ModeBadge = ({ label, mode }: { label: string; mode?: string }) => (
  <div className="flex flex-col gap-1 rounded-lg border p-4">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span
      className={`w-fit rounded px-1.5 py-0.5 font-mono text-sm font-semibold ${modeBadgeClass(mode)}`}
    >
      {enforceModeLabel(mode)}
    </span>
  </div>
);

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
                Live pipeline configuration from GET /v1/config. Read-only --
                flipping shadow/enforce here is a follow-up (PACT-327 scoped
                this console to visibility only).
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
              <ModeBadge
                label="Classifier"
                mode={config.classifierEnforceMode}
              />
              <ModeBadge
                label="Vector filter"
                mode={config.vectorEnforceMode}
              />
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

'use client';

import { Info } from 'lucide-react';
import { useState } from 'react';

import {
  patchEnforcement,
  type ConfigEnforcementPatchRequest,
  type GetConfigQueryResult,
} from '@/src/__codegen__/rest/config';
import {
  enforceModeLabel,
  isEnforcing,
  type GatewayConfig,
} from '@/src/app/gateway/domain/gateway_config';
import {
  applyOptimisticEnforcementPatch,
  buildEnforcementPatch,
  consensusModeLabel,
  enforcementPatchErrorMessage,
  isFlipToEnforce,
  CONSENSUS_MODE_OPTIONS,
  ENFORCE_MODE_OPTIONS,
  ENFORCEMENT_FIELD_LABELS,
  type EnforcementField,
  type ModeOption,
} from '@/src/app/gateway/domain/gateway_enforcement_patch';
import { type useGatewayConfig } from '@/src/app/gateway/domain/use_gateway_config';
import { type PendingEnforcementChange } from '@/src/app/gateway/ui/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/src/components/ui/alert-dialog';
import { ToggleGroup, ToggleGroupItem } from '@/src/components/ui/toggle-group';

const enforceBadgeClass = (mode?: string): string =>
  isEnforcing(mode)
    ? 'bg-destructive/10 text-destructive'
    : 'bg-amber-500/10 text-amber-600 dark:text-amber-400';

const CONSENSUS_BADGE_CLASS = 'bg-muted text-foreground';

const currentValueFor = (
  config: GatewayConfig,
  field: EnforcementField
): string | undefined => {
  if (field === 'classifierEnforceMode') return config.classifierEnforceMode;
  if (field === 'vectorEnforceMode') return config.vectorEnforceMode;

  return config.consensusMode;
};

// fallbackConfigResponse only matters if SWR's cache is momentarily empty at
// the instant a patch fires, despite this component only rendering once
// `config` (read from that same cache) is already loaded -- a defensive
// type-satisfier for a race that isn't reachable in steady state, same
// rationale as FilterDecisionsWorkbench's `current ?? data` fallback.
const fallbackConfigResponse = (
  config: GatewayConfig
): GetConfigQueryResult => ({
  data: config,
  status: 200,
  headers: new Headers(),
});

const EnforcementModeTile = ({
  label,
  value,
  options,
  disabled,
  badgeClassName,
  valueLabel,
  onChange,
  testId,
}: {
  label: string;
  value: string | undefined;
  options: ModeOption[];
  disabled: boolean;
  badgeClassName: string;
  valueLabel: (value?: string) => string;
  onChange: (value: string) => void;
  testId: string;
}) => (
  <div
    className="flex flex-col gap-2 rounded-lg border p-4"
    data-testid={testId}
  >
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`w-fit rounded px-1.5 py-0.5 font-mono text-xs font-semibold ${badgeClassName}`}
      >
        {valueLabel(value)}
      </span>
    </div>
    <ToggleGroup
      type="single"
      variant="outline"
      size="sm"
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next);
      }}
      disabled={disabled}
    >
      {options.map((option) => (
        <ToggleGroupItem key={option.value} value={option.value}>
          {option.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  </div>
);

interface GatewayEnforcementControlsProps {
  config: GatewayConfig;
  mutate: ReturnType<typeof useGatewayConfig>['mutate'];
}

// GatewayEnforcementControls renders the three live runtime-enforcement
// controls (classifier/vector enforce mode, consensus mode) as segmented
// controls matching the read-only tiles' visual language, and writes
// through PACT-472's PATCH /v1/config/enforcement. Rendered as siblings
// inside GatewayEnforcementPanel's existing grid -- see that component for
// why classifier/vector no longer render as static ModeBadge tiles.
export const GatewayEnforcementControls = ({
  config,
  mutate,
}: GatewayEnforcementControlsProps) => {
  const [pendingChange, setPendingChange] =
    useState<PendingEnforcementChange | null>(null);
  const [mutatingField, setMutatingField] = useState<EnforcementField | null>(
    null
  );
  const [patchError, setPatchError] = useState<string | null>(null);

  const submitPatch = async (
    payload: ConfigEnforcementPatchRequest
  ): Promise<GetConfigQueryResult | undefined> => {
    const response = await patchEnforcement(payload);
    if (response.status !== 200) {
      throw new Error(enforcementPatchErrorMessage(response.status));
    }

    return undefined;
  };

  const applyPatch = async (field: EnforcementField, nextValue: string) => {
    const payload = buildEnforcementPatch(field, nextValue);
    setPatchError(null);
    setMutatingField(field);

    try {
      await mutate(submitPatch(payload), {
        optimisticData: (current) =>
          applyOptimisticEnforcementPatch(current, payload) ??
          current ??
          fallbackConfigResponse(config),
        rollbackOnError: true,
        populateCache: false,
        revalidate: true,
      });
    } catch (err) {
      setPatchError(
        err instanceof Error
          ? err.message
          : 'Failed to update enforcement mode.'
      );
    } finally {
      setMutatingField((prev) => (prev === field ? null : prev));
    }
  };

  const handleModeChange = (field: EnforcementField, nextValue: string) => {
    if (isFlipToEnforce(field, nextValue)) {
      setPendingChange({
        field,
        previousValue: currentValueFor(config, field),
        nextValue,
      });

      return;
    }

    void applyPatch(field, nextValue);
  };

  const handleConfirmEnforce = () => {
    if (!pendingChange) return;
    void applyPatch(pendingChange.field, pendingChange.nextValue);
  };

  return (
    <>
      <EnforcementModeTile
        label="Classifier"
        value={config.classifierEnforceMode}
        options={ENFORCE_MODE_OPTIONS}
        disabled={mutatingField === 'classifierEnforceMode'}
        badgeClassName={enforceBadgeClass(config.classifierEnforceMode)}
        valueLabel={enforceModeLabel}
        onChange={(next) => handleModeChange('classifierEnforceMode', next)}
        testId="gateway-classifier-mode-control"
      />
      <EnforcementModeTile
        label="Vector filter"
        value={config.vectorEnforceMode}
        options={ENFORCE_MODE_OPTIONS}
        disabled={mutatingField === 'vectorEnforceMode'}
        badgeClassName={enforceBadgeClass(config.vectorEnforceMode)}
        valueLabel={enforceModeLabel}
        onChange={(next) => handleModeChange('vectorEnforceMode', next)}
        testId="gateway-vector-mode-control"
      />
      <EnforcementModeTile
        label="Consensus mode"
        value={config.consensusMode}
        options={CONSENSUS_MODE_OPTIONS}
        disabled={mutatingField === 'consensusMode'}
        badgeClassName={CONSENSUS_BADGE_CLASS}
        valueLabel={consensusModeLabel}
        onChange={(next) => handleModeChange('consensusMode', next)}
        testId="gateway-consensus-mode-control"
      />

      <div
        className="col-span-2 flex flex-col gap-2 sm:col-span-4"
        data-testid="gateway-enforcement-controls-footer"
      >
        {patchError && (
          <p role="alert" className="text-sm text-destructive">
            {patchError}
          </p>
        )}
        <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          Runtime override - a gateway restart resets these to environment
          defaults.
        </p>
      </div>

      <AlertDialog
        open={pendingChange !== null}
        onOpenChange={(open) => {
          if (!open) setPendingChange(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Switch{' '}
              {pendingChange
                ? ENFORCEMENT_FIELD_LABELS[pendingChange.field]
                : ''}{' '}
              to Enforce?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingChange &&
                `This changes ${ENFORCEMENT_FIELD_LABELS[pendingChange.field]} from ${enforceModeLabel(pendingChange.previousValue)} to Enforce. The gateway will act on this decision instead of only logging it.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmEnforce}>
              Switch to Enforce
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

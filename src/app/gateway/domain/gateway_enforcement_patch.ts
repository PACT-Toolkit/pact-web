// Domain types and helpers for the gateway's runtime enforcement write path
// (PATCH /v1/config/enforcement, pact-gateway PACT-472, PACT-473 here).
// Pairs with gateway_config.ts's read-side EnforceMode/labels -- this file
// owns the write-path concerns: which fields are writable, what values a
// segmented control may pick from, the optimistic-cache transform for the
// mutation, and whether a given change needs an explicit confirmation step
// before it's sent.
//
// classifierEnforceMode / vectorEnforceMode only ever validate to "shadow"
// or "enforce" on the wire (pact-gateway internal/pipeline/types.go's
// IsValidEnforceMode) -- there is no "off" position, despite older issue
// prose describing a three-value off|shadow|enforce set. consensusMode
// validates to "inline" or "shadow" (IsValidConsensusMode). Both are
// enforced server-side with a 400 on any other value -- see
// gateway/mock/handlers/gateway.ts's PATCH handler for the mock mirroring
// that same validation.
import {
  type ConfigEnforcementPatchRequest,
  type GetConfigQueryResult,
} from '@/src/__codegen__/rest/config';

export type ConsensusMode = 'inline' | 'shadow';

// EnforcementField enumerates the three runtime knobs this panel writes.
// classifierEnforceMode and vectorEnforceMode share the EnforceMode value
// set; consensusMode has its own two-value set.
export type EnforcementField =
  | 'classifierEnforceMode'
  | 'vectorEnforceMode'
  | 'consensusMode';

export interface ModeOption {
  value: string;
  label: string;
}

// ENFORCE_MODE_OPTIONS backs the classifier/vector segmented controls.
export const ENFORCE_MODE_OPTIONS: ModeOption[] = [
  { value: 'shadow', label: 'Shadow' },
  { value: 'enforce', label: 'Enforce' },
];

// CONSENSUS_MODE_OPTIONS backs the consensus segmented control.
export const CONSENSUS_MODE_OPTIONS: ModeOption[] = [
  { value: 'inline', label: 'Inline' },
  { value: 'shadow', label: 'Shadow' },
];

export const ENFORCEMENT_FIELD_LABELS: Record<EnforcementField, string> = {
  classifierEnforceMode: 'Classifier enforcement',
  vectorEnforceMode: 'Vector filter enforcement',
  consensusMode: 'Consensus mode',
};

// consensusModeLabel mirrors gateway_config.ts's enforceModeLabel, but for
// the inline/shadow value set. Falls back to the raw string for a future
// mode value this console doesn't know about yet, rather than hiding it.
export const consensusModeLabel = (mode?: string): string => {
  if (mode === 'inline') return 'Inline';
  if (mode === 'shadow') return 'Shadow';

  return mode ?? 'Unknown';
};

// isFlipToEnforce is true only when the field being changed is one of the
// two enforce-mode fields and the new value is "enforce" -- the one
// direction the product spec requires an explicit confirmation for. Flips
// toward shadow/inline apply immediately (consensusMode never has an
// "enforce" value, so it never triggers this).
export const isFlipToEnforce = (
  field: EnforcementField,
  nextValue: string
): boolean =>
  (field === 'classifierEnforceMode' || field === 'vectorEnforceMode') &&
  nextValue === 'enforce';

// buildEnforcementPatch wraps a single field change into the partial PATCH
// body -- every other field is omitted (not set to undefined) so the
// gateway leaves it unchanged, matching PACT-472's partial-update contract.
export const buildEnforcementPatch = (
  field: EnforcementField,
  value: string
): ConfigEnforcementPatchRequest => {
  switch (field) {
    case 'classifierEnforceMode':
      return { classifierEnforceMode: value };
    case 'vectorEnforceMode':
      return { vectorEnforceMode: value };
    case 'consensusMode':
      return { consensusMode: value };
  }
};

// applyOptimisticEnforcementPatch merges a pending patch into the cached GET
// /v1/config response so the panel reflects the new mode before the request
// resolves. Only merges on top of a known-good 200 snapshot -- an error
// response is left untouched, matching applyOptimisticAnnotationFlag's
// guard in filter_false_positive.ts. rollbackOnError (wired at the call
// site) reverts this if the request fails.
export const applyOptimisticEnforcementPatch = (
  current: GetConfigQueryResult | undefined,
  patch: ConfigEnforcementPatchRequest
): GetConfigQueryResult | undefined => {
  if (!current || current.status !== 200) return current;

  return {
    ...current,
    data: { ...current.data, ...patch },
  };
};

// enforcementPatchErrorMessage turns a non-200 PATCH status into operator-
// readable copy. 403 is called out explicitly per PACT-473's spec (the
// write surface requires the config:enforce permission server-side) so a
// forbidden operator sees why, not a generic failure.
export const enforcementPatchErrorMessage = (status: number): string => {
  if (status === 403) {
    return 'You do not have permission to change the enforcement mode.';
  }
  if (status === 400) {
    return 'The gateway rejected that value.';
  }

  return `Failed to update enforcement mode (${status}).`;
};

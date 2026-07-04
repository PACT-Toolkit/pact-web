// Domain types and helpers for the gateway's live enforcement posture (GET
// /v1/config, pact-gateway PACT-320, PR #88). This is the read-only source of
// truth the other three /gateway sections (sandbox, diagnostics, spotlight)
// gate their empty/disabled states on -- see use_gateway_config.ts's docblock
// for why every section re-reads the same SWR key instead of prop-drilling.
//
// Wire type generated from schema/config (pulled from pact-gateway's
// api/swagger/config.yaml per-tag slice, same recipe as schema/check and
// schema/classifier). Every field is optional in the generated type because
// the swagger definition declares no `required` array -- ConfigResponse is a
// deliberately-curated allowlist (see pact-gateway's
// internal/features/config/types.go docblock: "the whole app.Config struct is
// never marshalled... No secrets are present"), so treat a missing field as
// "the gateway build running today predates it," not an error.
import { type ConfigConfigResponse } from '@/src/__codegen__/rest/config';

export type GatewayConfig = ConfigConfigResponse;

// EnforceMode mirrors the two literal values pact-gateway emits for
// classifierEnforceMode / vectorEnforceMode. Kept as a loose string union
// (not validated) since the field is free-form on the wire, same convention
// as PolicyEvent.decision / FilterInfo.verdict elsewhere in this codebase.
export type EnforceMode = 'shadow' | 'enforce';

export const isEnforcing = (mode?: string): boolean => mode === 'enforce';

// enforceModeLabel renders the badge text for classifierEnforceMode /
// vectorEnforceMode. Falls back to the raw string for a future mode value
// this console doesn't know about yet, rather than hiding it.
export const enforceModeLabel = (mode?: string): string => {
  if (mode === 'enforce') return 'Enforce';
  if (mode === 'shadow') return 'Shadow';

  return mode ?? 'Unknown';
};

// consensusThresholdLabel renders the 0-1 score threshold as a percentage,
// matching the classifier console's score formatting convention.
export const consensusThresholdLabel = (threshold?: number): string =>
  typeof threshold === 'number' ? `${(threshold * 100).toFixed(0)}%` : '--';

// sandboxIsolationLabel expands the two documented isolation levels
// (pact-gateway internal/app/config.go's SANDBOX_ISOLATION validation) into
// operator-readable copy. Any other value (future isolation level) is passed
// through verbatim.
export const sandboxIsolationLabel = (isolation?: string): string => {
  if (isolation === 'namespace') return 'Namespace (user+mount, /proc masked)';
  if (isolation === 'none') return 'None (plain process)';

  return isolation ?? 'Unknown';
};

export const spotlightFormatLabel = (format?: string): string => {
  if (format === 'delim') return 'Delimiter markers';
  if (format === 'xml') return 'XML tags';
  if (format === 'json') return 'JSON envelope';

  return format ?? 'Unknown';
};

export const requestTimeoutLabel = (seconds?: number): string =>
  typeof seconds === 'number' ? `${seconds}s` : '--';

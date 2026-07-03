// Domain helpers for the capability-token issuance panel (POST
// /v1/policy/tokens, PACT-319). Wire types are generated from
// pact-gateway's per-tag swagger slice (schema/policy, pulled from
// pact-gateway's api/swagger/policy.yaml).
import {
  type PolicyIssueTokenRequest,
  type PolicyIssueTokenResponse,
} from '@/src/__codegen__/rest/policy';

export type IssueTokenInput = PolicyIssueTokenRequest;
export type IssuedToken = PolicyIssueTokenResponse;

// Gateway-documented bounds for ttlSeconds (api/swagger/policy.yaml's 400
// response description: "ttlSeconds must be 1..86400"). Exposed so the form
// can clamp/validate client-side before round-tripping to the gateway.
export const MIN_TTL_SECONDS = 1;
export const MAX_TTL_SECONDS = 86_400;
export const DEFAULT_TTL_SECONDS = 3_600;

export interface BuildIssueTokenRequestParams {
  agentId: string;
  toolId: string;
  scopes: string[];
  ttlSeconds: number;
}

// buildIssueTokenRequest trims the identifiers and drops an empty scopes
// array to undefined so the request mirrors what a caller who omits the
// optional field would send -- the mock and the real gateway both 400 on
// an empty scopes list (see policy.yaml's "scopes must be non-empty").
export const buildIssueTokenRequest = (
  params: BuildIssueTokenRequestParams
): IssueTokenInput => ({
  agentId: params.agentId.trim(),
  toolId: params.toolId.trim(),
  scopes: params.scopes.length > 0 ? params.scopes : undefined,
  ttlSeconds: params.ttlSeconds,
});

// isIssueTokenInputValid runs the same client-side checks the gateway
// enforces at runtime, so the submit button can disable before a doomed
// request round-trips.
export const isIssueTokenInputValid = (
  params: BuildIssueTokenRequestParams
): boolean =>
  params.agentId.trim() !== '' &&
  params.toolId.trim() !== '' &&
  params.scopes.length > 0 &&
  Number.isInteger(params.ttlSeconds) &&
  params.ttlSeconds >= MIN_TTL_SECONDS &&
  params.ttlSeconds <= MAX_TTL_SECONDS;

// formatExpiry renders a unix-seconds expiry as a locale timestamp, mirroring
// the formatTimestamp helpers already used by RuleEditor/PolicyEventsFeed.
export const formatExpiry = (expiresAtUnix: number): string => {
  const d = new Date(expiresAtUnix * 1000);
  if (Number.isNaN(d.getTime())) return String(expiresAtUnix);

  return d.toLocaleString(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

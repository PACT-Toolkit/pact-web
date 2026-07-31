import { getGatewayBaseUrl } from '@/src/lib/proxy/gateway_url';

// Redeems a pact_refresh_token cookie value against pact-gateway's
// bearer-less POST /v1/auth/session/refresh (added for PACT-726) and returns
// the new session/refresh pair, or null if the token was missing, invalid,
// expired, or already used (pact-gateway answers all of those with a plain
// 400/401 body - see internal/features/auth/handler.go - so both statuses
// are treated as "renewal failed" here, not just 401).
//
// This lives in src/lib (not src/framework/auth/pact_auth/client.ts) because
// the caller - proxy.ts's silent-renewal branch - runs on the Edge runtime by
// default (no `experimental.nodeMiddleware` / `runtime: 'nodejs'` config
// exists in next.config.ts), and client.ts imports `next/headers`, which is
// not callable from middleware. A plain `fetch` against pact-gateway's
// already-public base URL has no such constraint. See proxy.ts's own
// docblock for the full runtime/race-safety writeup.
//
// Deliberately does NOT import the generated auth REST types
// (src/__codegen__/rest/auth) - the lib layer cannot import from codegen
// (see AGENTS.md's boundaries table), same restriction that already forced
// proxy_to_gateway.ts to hand-roll its own RotatedPair type below instead of
// reusing AuthSessionResponse.
export type RedeemedSession = {
  sessionToken: string;
  refreshToken: string;
  expiresAtUnix: number;
};

// Single-flights concurrent redemption attempts for the same (single-use)
// refresh token value. Mirrors the leader/follower shape proxy_to_gateway.ts
// already uses for the same underlying hazard (pact-auth revokes the whole
// token family on reuse), but is NOT the same Map instance and cannot be
// merged into one: proxy_to_gateway.ts's rotation only ever fires when a
// *session* cookie is present (it keys on that cookie and only attaches
// X-Pact-Refresh-Token when `session && refresh`), while this module only
// ever runs when the session cookie is *absent* - the two conditions are
// mutually exclusive on every request, so there is no shared state to
// deduplicate across them in the first place. What this Map dedupes is
// narrower: several concurrent navigations/prefetches from the same browser
// tab, all missing the session cookie, all racing to redeem the one refresh
// token they share. Best-effort within a single runtime instance - not a
// cross-instance cache, not a cross-runtime lock.
const inFlightRenewal = new Map<string, Promise<RedeemedSession | null>>();

export const redeemRefreshToken = async (
  refreshToken: string,
  clientIp?: string
): Promise<RedeemedSession | null> => {
  const existing = inFlightRenewal.get(refreshToken);
  if (existing) return existing;

  const promise = redeemOnce(refreshToken, clientIp).finally(() => {
    inFlightRenewal.delete(refreshToken);
  });
  inFlightRenewal.set(refreshToken, promise);

  return promise;
};

const redeemOnce = async (
  refreshToken: string,
  clientIp?: string
): Promise<RedeemedSession | null> => {
  const headers = new Headers({ 'x-pact-refresh-token': refreshToken });
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  let res: Response;
  try {
    res = await fetch(`${getGatewayBaseUrl()}/v1/auth/session/refresh`, {
      method: 'POST',
      headers,
    });
  } catch {
    // Network blip or pact-gateway unreachable. Fail closed - the caller
    // falls back to the normal /login redirect.
    return null;
  }

  if (!res.ok) return null;

  let body: {
    sessionToken?: string;
    refreshToken?: string;
    expiresAtUnix?: number;
  };
  try {
    body = await res.json();
  } catch {
    return null;
  }

  if (!body.sessionToken || !body.refreshToken || !body.expiresAtUnix) {
    return null;
  }

  return {
    sessionToken: body.sessionToken,
    refreshToken: body.refreshToken,
    expiresAtUnix: body.expiresAtUnix,
  };
};

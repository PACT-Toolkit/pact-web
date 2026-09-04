import { type NextRequest, NextResponse } from 'next/server';

import { authCookieBaseOptions } from '@/src/lib/cookie_options';
import { appendForwardedFor, inboundClientIp } from '@/src/lib/proxy/client_ip';
import { getGatewayBaseUrl } from '@/src/lib/proxy/gateway_url';
import {
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS,
  SESSION_COOKIE,
} from '@/src/lib/session_cookie';

// Shared core of every pact-gateway edge proxy route in this app: translates
// the pact_session cookie into the Authorization: Bearer header
// pact-gateway's authMiddleware expects, forwards the request, and
// propagates a rotated session (new session/refresh token pair) back to the
// browser cookie jar.
//
// Extracted under PACT-390/PACT-416: the rules publish/revoke endpoints
// shipped with no explicit proxy route, so requests fell through to
// app/api/pact/[...path]/route.ts, which built the wrong upstream URL and
// never did this cookie-to-Bearer translation at all. Every proxy route in
// the app previously duplicated this logic by hand (~10 copies, already
// drifting - some hardcoded Content-Type, some forwarded the inbound
// X-Pact-Refresh-Token header and some didn't). Centralising it here means
// the next new endpoint gets the translation for free instead of silently
// falling back to the broken catch-all again.
//
// PACT-705: pact_refresh_token is now a real httpOnly cookie (set
// server-side at login/MFA-finish/OAuth-callback - see
// src/framework/auth/pact_auth/cookies.ts's setSessionCookies), so this
// proxy attaches it as X-Pact-Refresh-Token on every call rather than
// relying on an opt-in per-route flag - client JS never had a way to set
// that header itself, so the old ProxyToGatewayOptions.forwardRefreshHeader
// toggle was dead weight kept alive by three routes that happened to opt
// in. Every gateway-proxied endpoint now gets silent renewal for free.
//
// Callers still declare their own exported HTTP verb handlers (GET, POST,
// etc) and own their method allowlist and upstream path construction
// (static path, dynamic id segment, or a joined catch-all path) - this
// helper only owns the fetch + cookie/header translation that is identical
// across all of them.

const REFRESH_HEADER = 'x-pact-refresh-token';
const NEW_SESSION_HEADER = 'x-pact-new-session-token';
const NEW_REFRESH_HEADER = 'x-pact-new-refresh-token';
const NEW_EXPIRES_HEADER = 'x-pact-new-expires-at-unix';

export interface ProxyToGatewayOptions {
  // Path on pact-gateway to forward to, e.g. "/v1/rules" or
  // "/v1/rules/abc-123/publish". Must start with "/v1/" - the caller owns
  // building it (static string, encodeURIComponent'd dynamic segment, or a
  // joined catch-all path) and appending it here.
  upstreamPath: string;
}

type RotatedPair = {
  sessionToken: string;
  refreshToken: string;
  expiresAtUnix: string;
};

// Single-flights the gateway's near-expiry refresh across concurrent
// requests that present the same (pre-rotation) session cookie value.
// Refresh tokens are single-use - pact-gateway's authMiddleware docblock
// calls this out as the CONCURRENT-REFRESH HAZARD: presenting the same
// refresh token twice trips pact-auth's reuse-detection and revokes the
// whole token family, logging the user out even though every request was
// legitimate. Keyed by the inbound session-cookie value: the first
// concurrent request for a given session becomes the "leader" (the only
// one that attaches X-Pact-Refresh-Token upstream); any other request
// racing in on the same not-yet-rotated session cookie is a "follower" - it
// still makes its own business call (the session token is still valid
// inside the refresh threshold; that's the whole point of the threshold),
// it just doesn't attempt a second refresh, and waits for the leader's
// outcome so its own response can carry the same rotated cookies. Entries
// are removed as soon as they resolve - this dedups one concurrent burst,
// it is not a cache.
const inFlightRefresh = new Map<string, Promise<RotatedPair | null>>();

// Strips the rotation headers and other transport-level headers off an
// upstream response and wraps the rest in a NextResponse. Stripping the raw
// rotation headers here (rather than leaving them for the caller to read
// once) matters because this now runs twice on a follower's retry path -
// forgetting it on either call would leak the refresh token to client JS,
// exactly what PACT-705 moved off of.
const toProxyResponse = (upstream: Response): NextResponse => {
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (
      k === 'content-encoding' ||
      k === 'transfer-encoding' ||
      k === 'connection' ||
      k === NEW_SESSION_HEADER ||
      k === NEW_REFRESH_HEADER ||
      k === NEW_EXPIRES_HEADER
    ) {
      return;
    }
    out.set(key, value);
  });

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
};

// Reads the gateway's rotated-session response headers, if present.
const readRotatedPair = (upstream: Response): RotatedPair | null => {
  const newSession = upstream.headers.get(NEW_SESSION_HEADER);
  const newExpires = upstream.headers.get(NEW_EXPIRES_HEADER);
  if (!newSession || !newExpires) return null;

  return {
    sessionToken: newSession,
    refreshToken: upstream.headers.get(NEW_REFRESH_HEADER) ?? '',
    expiresAtUnix: newExpires,
  };
};

export async function proxyToGateway(
  req: NextRequest,
  { upstreamPath }: ProxyToGatewayOptions
): Promise<NextResponse> {
  // Build a fresh header map: never blindly forward the inbound Cookie
  // (which may carry pact_session and any other browser cookies); only
  // surface the bearer token and refresh token the gateway actually
  // consumes.
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const refresh = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (session) headers.set('authorization', `Bearer ${session}`);

  const leaderPromise = session ? inFlightRefresh.get(session) : undefined;
  const isFollower = Boolean(leaderPromise);
  let resolveLeader: ((pair: RotatedPair | null) => void) | undefined;
  if (refresh && session && !leaderPromise) {
    headers.set(REFRESH_HEADER, refresh);
    const promise = new Promise<RotatedPair | null>((resolve) => {
      resolveLeader = resolve;
    });
    inFlightRefresh.set(session, promise);
  }

  // Forward the end-user's client IP to pact-gateway (PACT-687). Same
  // single-trusted-hop model as the pact-auth REST client
  // (src/framework/auth/pact_auth/client.ts): pact-gateway's rate limiter
  // (trustedProxyHops=1) reads only the right-most X-Forwarded-For entry,
  // so exactly one hop - pact-web's own trusted determination of the
  // client IP - is appended here, never replacing anything already on
  // this (freshly built) outbound header.
  const forwardedFor = appendForwardedFor(
    headers.get('x-forwarded-for'),
    inboundClientIp(req.headers)
  );
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';

  // PACT-914: a follower attaches the pre-rotation bearer (the session
  // cookie value is still the old one on the way in) and can come back 401
  // from pact-gateway while the leader is still redeeming the refresh
  // token - the session genuinely was near/past expiry, that's why a
  // refresh was needed in the first place. A follower with a body can only
  // retry with the rotated bearer if its request body is still readable, so
  // buffer it up front: a streaming body can only be consumed once, and by
  // the time a 401 comes back the original req.body stream is already
  // spent. Only followers ever retry, so only followers pay for buffering.
  const bufferedBody =
    isFollower && hasBody ? await req.arrayBuffer() : undefined;

  const fetchUpstream = (fetchHeaders: Headers) =>
    fetch(`${getGatewayBaseUrl()}${upstreamPath}${req.nextUrl.search}`, {
      method: req.method,
      headers: fetchHeaders,
      ...(hasBody && { body: bufferedBody ?? req.body, duplex: 'half' }),
    } as RequestInit);

  let rotated: RotatedPair | null = null;
  let res: NextResponse;
  let upstreamStatus: number;
  try {
    const upstream = await fetchUpstream(headers);
    upstreamStatus = upstream.status;
    res = toProxyResponse(upstream);
    rotated = readRotatedPair(upstream);
  } finally {
    // Whatever happened (rotation, no rotation, or the fetch above threw),
    // this session is no longer "in flight" - release any follower waiting
    // on us and let the next concurrent burst start a fresh leader.
    if (resolveLeader) {
      resolveLeader(rotated);
      if (session) inFlightRefresh.delete(session);
    }
  }

  // We were a follower: adopt the leader's rotated pair (if it rotated one)
  // even though our own upstream response carried none - it's the only one
  // that actually asked pact-gateway to rotate, so its outcome is
  // authoritative for this session.
  let leaderRotated: RotatedPair | null = null;
  if (leaderPromise) {
    leaderRotated = await leaderPromise;
    if (leaderRotated) rotated = leaderRotated;
  }

  // A follower's own 401 was against the now-rotated-away bearer, not a
  // real auth failure - retry exactly once with the rotated bearer the
  // leader minted, no refresh header (that would attempt a second redemption
  // of a token the leader already spent - the CONCURRENT-REFRESH HAZARD this
  // whole leader/follower split exists to avoid). If the leader itself came
  // back 401, or never rotated at all, there is nothing to retry with - the
  // 401 stands, same as today.
  if (isFollower && upstreamStatus === 401 && leaderRotated) {
    const retryHeaders = new Headers(headers);
    retryHeaders.set('authorization', `Bearer ${leaderRotated.sessionToken}`);
    retryHeaders.delete(REFRESH_HEADER);
    const retryUpstream = await fetchUpstream(retryHeaders);
    res = toProxyResponse(retryUpstream);
  }

  // If the gateway minted (or a leader we rode along with minted) a new
  // session pair, roll both cookies forward server-side so the next
  // browser request already has them.
  if (rotated) {
    res.cookies.set({
      name: SESSION_COOKIE,
      value: rotated.sessionToken,
      ...authCookieBaseOptions(),
      expires: new Date(Number(rotated.expiresAtUnix) * 1000),
    });
    if (rotated.refreshToken) {
      res.cookies.set({
        name: REFRESH_TOKEN_COOKIE,
        value: rotated.refreshToken,
        ...authCookieBaseOptions(),
        maxAge: REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS,
      });
    }
  }

  return res;
}

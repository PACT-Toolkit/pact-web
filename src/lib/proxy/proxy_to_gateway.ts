import { type NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE } from '@/src/lib/session_cookie';

// Shared core of every pact-gateway edge proxy route in this app: translates
// the pact_session cookie into the Authorization: Bearer header
// pact-gateway's authMiddleware expects, forwards the request, and
// propagates a rotated session (new session/refresh token pair) back to the
// browser cookie.
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
// Callers still declare their own exported HTTP verb handlers (GET, POST,
// etc) and own their method allowlist and upstream path construction
// (static path, dynamic id segment, or a joined catch-all path) - this
// helper only owns the fetch + cookie/header translation that is identical
// across all of them.

const GATEWAY_URL = process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080';
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
  // Forward the inbound X-Pact-Refresh-Token request header upstream. Only
  // the /v1/account, /v1/audit, and /v1/files edge proxies do this today -
  // the SPA sends it on near-expiry calls so the gateway can rotate the
  // session without bouncing the user. Defaults to false.
  forwardRefreshHeader?: boolean;
}

export async function proxyToGateway(
  req: NextRequest,
  { upstreamPath, forwardRefreshHeader = false }: ProxyToGatewayOptions
): Promise<NextResponse> {
  // Build a fresh header map: never blindly forward the inbound Cookie
  // (which may carry pact_session and any other browser cookies); only
  // surface the bearer token the gateway actually consumes.
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const headers = new Headers();
  const contentType = req.headers.get('content-type');
  if (contentType) headers.set('content-type', contentType);
  if (session) headers.set('authorization', `Bearer ${session}`);
  if (forwardRefreshHeader) {
    const refresh = req.headers.get(REFRESH_HEADER);
    if (refresh) headers.set(REFRESH_HEADER, refresh);
  }

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const upstream = await fetch(
    `${GATEWAY_URL}${upstreamPath}${req.nextUrl.search}`,
    {
      method: req.method,
      headers,
      ...(hasBody && { body: req.body, duplex: 'half' }),
    } as RequestInit
  );

  // Surface the gateway's response. Strip transport-level headers that
  // don't survive a re-stream (Node sets these itself on the outbound
  // response).
  const out = new Headers();
  upstream.headers.forEach((value, key) => {
    const k = key.toLowerCase();
    if (
      k === 'content-encoding' ||
      k === 'transfer-encoding' ||
      k === 'connection'
    ) {
      return;
    }
    out.set(key, value);
  });

  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });

  // If the gateway minted a new session pair, roll the cookie forward
  // server-side so the next browser request already has it.
  const newSession = upstream.headers.get(NEW_SESSION_HEADER);
  const newExpires = upstream.headers.get(NEW_EXPIRES_HEADER);
  if (newSession && newExpires) {
    res.cookies.set({
      name: SESSION_COOKIE,
      value: newSession,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      expires: new Date(Number(newExpires) * 1000),
    });
  }
  // Preserve the new refresh-token header so the SPA can persist it
  // wherever it stores refresh credentials.
  const newRefresh = upstream.headers.get(NEW_REFRESH_HEADER);
  if (newRefresh) res.headers.set(NEW_REFRESH_HEADER, newRefresh);

  return res;
}

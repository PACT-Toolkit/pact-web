import { type NextRequest, NextResponse } from 'next/server';

// Route handler proxy for POST /api/pact/gateway/v1/benchmark/jobs →
// pact-gateway /v1/benchmark/jobs (submit a corpus bulk-test job).
//
// Relocated from /api/pact/benchmark/v1/jobs under PACT-465, which moved the
// whole schema/benchmark orval group onto the gateway-edge-proxy baseUrl
// convention (mirroring schema/filter) so Test Lab's corpus/testlab-runs
// hooks resolve correctly -- this bulk-test surface shares the same
// pact-gateway swagger tag and moves with it. Logic is unchanged: still
// reached through the gateway (auth-gated, rate-limited), not pact-benchmark's
// internal port directly. In mock mode MSW intercepts the browser fetch before
// it reaches Next.js, so this handler is only hit in real mode. Translates the
// pact_session cookie → Bearer header that pact-gateway's authMiddleware
// expects, and propagates a rotated session back to the browser cookie (same
// pattern as app/api/pact/gateway/v1/rules/route.ts).

const GATEWAY_URL = process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080';
const SESSION_COOKIE = 'pact_session';
const NEW_SESSION_HEADER = 'x-pact-new-session-token';
const NEW_REFRESH_HEADER = 'x-pact-new-refresh-token';
const NEW_EXPIRES_HEADER = 'x-pact-new-expires-at-unix';

export async function POST(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const headers = new Headers();
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  if (session) headers.set('authorization', `Bearer ${session}`);

  const upstream = await fetch(`${GATEWAY_URL}/v1/benchmark/jobs`, {
    method: 'POST',
    headers,
    body: req.body,
    duplex: 'half',
  } as RequestInit);

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
  const newRefresh = upstream.headers.get(NEW_REFRESH_HEADER);
  if (newRefresh) res.headers.set(NEW_REFRESH_HEADER, newRefresh);

  return res;
}

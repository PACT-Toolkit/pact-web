import { type NextRequest, NextResponse } from 'next/server';

// Route handler proxy for /api/pact/gateway/v1/benchmark/runs → pact-gateway
// /v1/benchmark/runs.
//
// Relocated from /api/pact/benchmark/v1/runs under PACT-465 -- see
// app/api/pact/gateway/v1/benchmark/jobs/route.ts's docblock. Logic is
// unchanged: benchmark run history is still read through the gateway
// (auth-gated, rate-limited), not by hitting pact-benchmark's internal port
// directly. In mock mode MSW intercepts the browser fetch before it reaches
// Next.js, so this handler is only hit in real mode. Translates the
// pact_session cookie → Bearer header that pact-gateway's authMiddleware
// expects, and propagates a rotated session back to the browser cookie (same
// pattern as app/api/pact/gateway/v1/rules/route.ts).

const GATEWAY_URL = process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080';
const SESSION_COOKIE = 'pact_session';
const NEW_SESSION_HEADER = 'x-pact-new-session-token';
const NEW_REFRESH_HEADER = 'x-pact-new-refresh-token';
const NEW_EXPIRES_HEADER = 'x-pact-new-expires-at-unix';

export async function GET(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const headers = new Headers();
  if (session) headers.set('authorization', `Bearer ${session}`);

  const upstream = await fetch(
    `${GATEWAY_URL}/v1/benchmark/runs${req.nextUrl.search}`,
    { method: 'GET', headers }
  );

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

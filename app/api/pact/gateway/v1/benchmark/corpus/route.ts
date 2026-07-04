import { type NextRequest, NextResponse } from 'next/server';

// Route handler proxy for POST /api/pact/gateway/v1/benchmark/corpus →
// pact-gateway /v1/benchmark/corpus (save one Test Lab corpus entry).
//
// PACT-465 retires the old direct-to-pact-benchmark proxy at
// /api/pact/benchmark/v1/corpus, which forwarded the pact_session cookie as
// an X-Pact-Actor header so pact-benchmark could scope rows per user without
// decoding the JWT itself. The gateway resolves the actor from the session
// server-side instead -- this handler only translates the pact_session
// cookie into the Bearer header pact-gateway's authMiddleware expects, and
// propagates a rotated session back to the browser cookie (same pattern as
// app/api/pact/gateway/v1/check/route.ts). In mock mode MSW intercepts the
// browser fetch before it reaches Next.js, so this handler is only hit in
// real mode.
//
// PACT-459 accepted an identity discontinuity here: the gateway persists the
// session user id verbatim, while the retired REST path persisted a hash of
// X-Pact-Actor. Rows saved through the old path will not appear under the
// gateway identity.

const GATEWAY_URL = process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080';
const SESSION_COOKIE = 'pact_session';
const NEW_SESSION_HEADER = 'x-pact-new-session-token';
const NEW_REFRESH_HEADER = 'x-pact-new-refresh-token';
const NEW_EXPIRES_HEADER = 'x-pact-new-expires-at-unix';

export async function POST(req: NextRequest) {
  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const headers = new Headers();
  headers.set('content-type', 'application/json');
  if (session) headers.set('authorization', `Bearer ${session}`);

  const upstream = await fetch(`${GATEWAY_URL}/v1/benchmark/corpus`, {
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

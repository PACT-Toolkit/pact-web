import { type NextRequest, NextResponse } from 'next/server';

// Root /v1/files/ handler. orval's RequestUpload fetcher calls
// POST /v1/files/ (with the trailing slash); Next's catch-all
// [...path]/route.ts requires at least one segment, so we handle
// the bare path here. Forwards to pact-gateway with the same
// session-cookie -> bearer-token translation and refresh-token
// reflection as app/v1/files/[...path]/route.ts.

const GATEWAY_URL = process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080';
const SESSION_COOKIE = 'pact_session';
const REFRESH_HEADER = 'x-pact-refresh-token';
const NEW_SESSION_HEADER = 'x-pact-new-session-token';
const NEW_REFRESH_HEADER = 'x-pact-new-refresh-token';
const NEW_EXPIRES_HEADER = 'x-pact-new-expires-at-unix';

async function proxy(req: NextRequest) {
  const target = `${GATEWAY_URL}/v1/files/${req.nextUrl.search}`;

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  const headers = new Headers();
  const ct = req.headers.get('content-type');
  if (ct) headers.set('content-type', ct);
  if (session) headers.set('authorization', `Bearer ${session}`);
  const refresh = req.headers.get(REFRESH_HEADER);
  if (refresh) headers.set(REFRESH_HEADER, refresh);

  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const upstream = await fetch(target, {
    method: req.method,
    headers,
    ...(hasBody && { body: req.body, duplex: 'half' }),
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
  const newSession = upstream.headers.get(NEW_SESSION_HEADER);
  const newExpires = upstream.headers.get(NEW_EXPIRES_HEADER);
  const res = new NextResponse(upstream.body, {
    status: upstream.status,
    headers: out,
  });
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
  if (newRefresh) {
    res.headers.set(NEW_REFRESH_HEADER, newRefresh);
  }

  return res;
}

export const GET = (req: NextRequest) => proxy(req);
export const POST = (req: NextRequest) => proxy(req);
export const PUT = (req: NextRequest) => proxy(req);
export const PATCH = (req: NextRequest) => proxy(req);
export const DELETE = (req: NextRequest) => proxy(req);

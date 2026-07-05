import { type NextRequest, NextResponse } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Fallback proxy for /api/pact/gateway/v1/* surfaces that don't have an
// explicit route handler yet (classifier, config, filter, policy). Every
// orval group in orval.config.ts that uses the `/api/pact/gateway/v1`
// baseUrl convention lands here unless a more specific route.ts under
// app/api/pact/gateway/v1/... matches first - Next.js always prefers the
// more specific static/dynamic segment route over a catch-all.
//
// PACT-390/PACT-416: this used to build the upstream URL as
// `${GATEWAY_URL}/api/pact/${path.join('/')}` (pact-gateway has no
// /api/pact/* namespace - always wrong), forward the browser's raw Cookie
// header instead of translating pact_session into a Bearer token, and
// reflect upstream response headers directly instead of stripping
// transport-level ones. Every request that fell through here - including,
// at the time, rules publish/revoke - was broken in real mode. Rewritten on
// proxyToGateway with the correct path mapping: strip the leading "gateway"
// path segment (the only namespace any caller under /api/pact/gateway/v1
// actually uses - see orval.config.ts) and forward the rest as
// pact-gateway's own /v1/... path.
//
// /api/pact/benchmark/v1/corpus/examples is a different, non-gateway static
// route (app/api/pact/benchmark/v1/corpus/examples/route.ts) and is never
// reached through this catch-all.

type RouteContext = { params: Promise<{ path: string[] }> };

async function proxy(req: NextRequest, { params }: RouteContext) {
  const { path } = await params;

  if (path[0] !== 'gateway') {
    // No known caller sends anything else under /api/pact/* today (see
    // orval.config.ts: every baseUrl using this prefix is
    // "/api/pact/gateway/v1"). Fail loudly rather than guess at a mapping
    // that could silently forward to the wrong upstream path.
    return NextResponse.json(
      { error: 'unknown /api/pact/* surface' },
      { status: 404 }
    );
  }

  return proxyToGateway(req, {
    upstreamPath: `/${path.slice(1).join('/')}`,
  });
}

export const GET = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
export const POST = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
export const PUT = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
export const PATCH = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);
export const DELETE = (req: NextRequest, ctx: RouteContext) => proxy(req, ctx);

import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for GET /api/pact/gateway/v1/benchmark/jobs/{id} ->
// pact-gateway /v1/benchmark/jobs/{id} (poll a bulk-test job's status and
// result).
//
// Relocated from /api/pact/benchmark/v1/jobs/{id} under PACT-465 - see
// app/api/pact/gateway/v1/benchmark/jobs/route.ts's docblock. Logic is
// unchanged: still reached through the gateway (auth-gated, rate-limited),
// not pact-benchmark's internal port directly. In mock mode MSW intercepts
// the browser fetch before it reaches Next.js, so this handler is only hit in
// real mode. See proxy_to_gateway.ts for the shared session-cookie -> Bearer
// translation and rotated-session handling.

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  return proxyToGateway(req, {
    upstreamPath: `/v1/benchmark/jobs/${encodeURIComponent(id)}`,
  });
}

import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for POST /api/pact/gateway/v1/rules/{id}/publish ->
// pact-gateway /v1/rules/{id}/publish.
//
// PACT-416: this endpoint had no explicit proxy route, so the generated
// publishRule() client's request fell through to the catch-all in
// app/api/pact/[...path]/route.ts, which built the wrong upstream URL and
// never translated the pact_session cookie into the Bearer header
// pact-gateway's authMiddleware expects - publish always failed in real
// mode. In mock mode MSW intercepts the browser fetch before it reaches
// Next.js, so this handler is only hit in real mode. See
// proxy_to_gateway.ts for the shared session-cookie -> Bearer translation
// and rotated-session handling.

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { id } = await params;

  return proxyToGateway(req, {
    upstreamPath: `/v1/rules/${encodeURIComponent(id)}/publish`,
  });
}

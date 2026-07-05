import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for /api/pact/gateway/v1/rules -> pact-gateway
// /v1/rules.
//
// In mock mode MSW intercepts the browser fetch before it reaches Next.js,
// so this handler is only hit in real mode. See proxy_to_gateway.ts for the
// shared session-cookie -> Bearer translation and rotated-session handling.
// Publish/revoke live in their own routes under rules/[id]/ (PACT-416) -
// they were previously unrouted and fell through to the (differently
// broken) catch-all in app/api/pact/[...path]/route.ts.

const proxy = (req: NextRequest) =>
  proxyToGateway(req, { upstreamPath: '/v1/rules' });

export const GET = proxy;
export const POST = proxy;

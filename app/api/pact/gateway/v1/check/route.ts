import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for /api/pact/gateway/v1/check -> pact-gateway /v1/check.
//
// In mock mode MSW intercepts the browser fetch before it reaches Next.js,
// so this handler is only hit in real mode. See proxy_to_gateway.ts for the
// shared session-cookie -> Bearer translation and rotated-session handling.

export const POST = (req: NextRequest) =>
  proxyToGateway(req, { upstreamPath: '/v1/check' });

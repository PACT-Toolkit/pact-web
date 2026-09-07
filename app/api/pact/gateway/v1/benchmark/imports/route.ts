import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for POST /api/pact/gateway/v1/benchmark/imports ->
// pact-gateway /v1/benchmark/imports (queue a Hugging Face dataset import as
// a benchmark job).
//
// Same shape as jobs/route.ts's POST handler: reached through the gateway
// (auth-gated, rate-limited), not pact-benchmark's internal port directly. In
// mock mode MSW intercepts the browser fetch before it reaches Next.js, so
// this handler is only hit in real mode. See proxy_to_gateway.ts for the
// shared session-cookie -> Bearer translation and rotated-session handling.

export const POST = (req: NextRequest) =>
  proxyToGateway(req, { upstreamPath: '/v1/benchmark/imports' });

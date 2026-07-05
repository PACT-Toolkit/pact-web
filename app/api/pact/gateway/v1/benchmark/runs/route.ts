import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for GET /api/pact/gateway/v1/benchmark/runs ->
// pact-gateway /v1/benchmark/runs.
//
// Relocated from /api/pact/benchmark/v1/runs under PACT-465 - see
// app/api/pact/gateway/v1/benchmark/jobs/route.ts's docblock. Logic is
// unchanged: benchmark run history is still read through the gateway
// (auth-gated, rate-limited), not by hitting pact-benchmark's internal port
// directly. In mock mode MSW intercepts the browser fetch before it reaches
// Next.js, so this handler is only hit in real mode. See proxy_to_gateway.ts
// for the shared session-cookie -> Bearer translation and rotated-session
// handling.

export const GET = (req: NextRequest) =>
  proxyToGateway(req, { upstreamPath: '/v1/benchmark/runs' });

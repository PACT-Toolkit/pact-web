import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for POST /api/pact/gateway/v1/benchmark/jobs ->
// pact-gateway /v1/benchmark/jobs (submit a corpus bulk-test job).
//
// Relocated from /api/pact/benchmark/v1/jobs under PACT-465, which moved the
// whole schema/benchmark orval group onto the gateway-edge-proxy baseUrl
// convention (mirroring schema/filter) so Test Lab's corpus/testlab-runs
// hooks resolve correctly - this bulk-test surface shares the same
// pact-gateway swagger tag and moves with it. Logic is unchanged: still
// reached through the gateway (auth-gated, rate-limited), not pact-benchmark's
// internal port directly. In mock mode MSW intercepts the browser fetch before
// it reaches Next.js, so this handler is only hit in real mode. See
// proxy_to_gateway.ts for the shared session-cookie -> Bearer translation
// and rotated-session handling.

export const POST = (req: NextRequest) =>
  proxyToGateway(req, { upstreamPath: '/v1/benchmark/jobs' });

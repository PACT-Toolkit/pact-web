import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for GET /api/pact/gateway/v1/benchmark/imports/preview
// -> pact-gateway /v1/benchmark/imports/preview (inspect a Hugging Face
// dataset's schema and label values before importing it).
//
// Same shape as jobs/[id]/route.ts's GET handler: reached through the
// gateway (auth-gated, rate-limited), not pact-benchmark's internal port
// directly. The query string (slug, split, config, revision, label_column,
// sample_rows) is forwarded as-is by proxyToGateway. In mock mode MSW
// intercepts the browser fetch before it reaches Next.js, so this handler is
// only hit in real mode. See proxy_to_gateway.ts for the shared
// session-cookie -> Bearer translation and rotated-session handling.

export const GET = (req: NextRequest) =>
  proxyToGateway(req, { upstreamPath: '/v1/benchmark/imports/preview' });

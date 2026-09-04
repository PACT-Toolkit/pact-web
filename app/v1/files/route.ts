import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Root /v1/files handler, mirroring pact-gateway's own /v1/files
// list/create route 1:1 for callers hitting pact-web's /v1/* surface
// directly rather than through the SPA's /api/pact/gateway/v1 proxy
// convenience prefix. Next's catch-all [...path]/route.ts requires at
// least one path segment, so we handle the bare path here. See
// proxy_to_gateway.ts for the shared session-cookie -> Bearer
// translation, refresh-header forwarding, and rotated-session handling
// shared with app/v1/files/[...path]/route.ts.
//
// PACT-909: pact-gateway publishes GET/POST /v1/files without a
// trailing slash - forward the same bare path upstream.

const proxy = (req: NextRequest) =>
  proxyToGateway(req, {
    upstreamPath: '/v1/files',
  });

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

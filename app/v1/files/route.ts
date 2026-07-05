import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Root /v1/files/ handler. orval's RequestUpload fetcher calls
// POST /v1/files/ (with the trailing slash); Next's catch-all
// [...path]/route.ts requires at least one segment, so we handle
// the bare path here. See proxy_to_gateway.ts for the shared
// session-cookie -> Bearer translation, refresh-header forwarding, and
// rotated-session handling shared with app/v1/files/[...path]/route.ts.

const proxy = (req: NextRequest) =>
  proxyToGateway(req, {
    upstreamPath: '/v1/files/',
    forwardRefreshHeader: true,
  });

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;

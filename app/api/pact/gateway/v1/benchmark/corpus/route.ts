import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for POST /api/pact/gateway/v1/benchmark/corpus ->
// pact-gateway /v1/benchmark/corpus (save one Test Lab corpus entry).
//
// PACT-465 retires the old direct-to-pact-benchmark proxy at
// /api/pact/benchmark/v1/corpus, which forwarded the pact_session cookie as
// an X-Pact-Actor header so pact-benchmark could scope rows per user without
// decoding the JWT itself. The gateway resolves the actor from the session
// server-side instead. In mock mode MSW intercepts the browser fetch before
// it reaches Next.js, so this handler is only hit in real mode. See
// proxy_to_gateway.ts for the shared session-cookie -> Bearer translation
// and rotated-session handling.
//
// PACT-459 accepted an identity discontinuity here: the gateway persists the
// session user id verbatim, while the retired REST path persisted a hash of
// X-Pact-Actor. Rows saved through the old path will not appear under the
// gateway identity.

export const POST = (req: NextRequest) =>
  proxyToGateway(req, { upstreamPath: '/v1/benchmark/corpus' });

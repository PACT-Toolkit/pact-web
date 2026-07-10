import { type NextRequest } from 'next/server';

import { proxyToGateway } from '@/src/lib/proxy/proxy_to_gateway';

// Route handler proxy for GET /api/pact/gateway/v1/benchmark/corpus/library ->
// pact-gateway /v1/benchmark/corpus/library.
//
// PACT-483: surfaces the aggregate corpus_library stats pact-benchmark's
// `corpus ingest` CLI populates, so the Benchmark page can show what corpus
// data is available server-side. Same proxy pattern as the sibling
// benchmark/corpus and benchmark/runs routes -- see corpus/route.ts's
// docblock for the session-cookie -> Bearer translation this shares. In mock
// mode MSW intercepts the browser fetch before it reaches Next.js, so this
// handler is only hit in real mode.

export const GET = (req: NextRequest) =>
  proxyToGateway(req, { upstreamPath: '/v1/benchmark/corpus/library' });

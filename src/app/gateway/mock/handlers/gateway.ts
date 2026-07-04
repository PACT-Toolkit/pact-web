import { http, HttpResponse, type RequestHandler } from 'msw';

import { GATEWAY_CONFIG_MOCK } from '@/src/app/gateway/mock/data/gateway';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// GET /v1/config is the only route this feature owns outright. The other
// three /gateway sections (sandbox/diagnostics/spotlight) ride the shared
// POST /v1/check handler in src/app/test_lab/mock/handlers/test_lab.ts --
// see mock/data/gateway.ts's docblock for why.
export const handlers: RequestHandler[] = [
  http.get(`${MSW_PACT_BASE}/gateway/v1/config`, () =>
    HttpResponse.json(GATEWAY_CONFIG_MOCK)
  ),
];

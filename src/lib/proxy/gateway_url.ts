// Single source of truth for pact-gateway's base URL. Every module that
// talks to the gateway directly (the cookie-to-Bearer proxy helper, the auth
// REST client, BenchmarkWorkbench's direct browser fetch) reads it from here
// instead of re-declaring the same `... ?? 'http://localhost:8110'`
// expression - see PACT-681, which added the second caller and made the
// duplication worth collapsing.
const GATEWAY_DEFAULT_URL = 'http://localhost:8110';

export const getGatewayBaseUrl = (): string =>
  process.env.PACT_GATEWAY_URL ?? GATEWAY_DEFAULT_URL;

// Client-safe counterpart. Next.js only inlines NEXT_PUBLIC_-prefixed env
// vars into the browser bundle, so code that runs in the browser (unlike
// the server-only callers of getGatewayBaseUrl above) must read the public
// variant instead.
export const getPublicGatewayBaseUrl = (): string =>
  process.env.NEXT_PUBLIC_PACT_GATEWAY_URL ?? GATEWAY_DEFAULT_URL;

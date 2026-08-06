// Single source of truth for pact-gateway's server-side base URL. Every
// module that talks to the gateway directly (the cookie-to-Bearer proxy
// helper, the auth REST client) reads it from here instead of re-declaring
// the same `process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080'`
// expression - see PACT-681, which added the second caller and made the
// duplication worth collapsing.
export const getGatewayBaseUrl = (): string =>
  process.env.PACT_GATEWAY_URL ?? 'http://localhost:8080';

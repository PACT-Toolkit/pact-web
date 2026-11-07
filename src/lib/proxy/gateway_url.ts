// Single source of truth for pact-gateway's base URL. Every module that
// talks to the gateway directly (the cookie-to-Bearer proxy helper, the auth
// REST client, the token refresh helper) reads it from here instead of
// re-declaring the same `... ?? 'http://localhost:8110'` expression. The
// browser never learns this URL: the gateway's benchmark proxy uses its own
// configured address.
const GATEWAY_DEFAULT_URL = 'http://localhost:8110';

export const getGatewayBaseUrl = (): string =>
  process.env.PACT_GATEWAY_URL ?? GATEWAY_DEFAULT_URL;

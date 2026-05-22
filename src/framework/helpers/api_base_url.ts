import 'server-only';

// Absolute base URL for server-side fetch() calls.
//
// Why this exists: a Server Component running on Node has no
// location.origin, so fetch() needs an absolute URL — relative paths
// throw "Failed to parse URL". Returning a loopback URL pointed at the
// Next.js dev server itself means:
//
//   - In `pnpm run dev:mock`, the global fetch passes through MSW's
//     node interceptor (started by instrumentation.ts) so handlers in
//     mocks/handlers.ts match the same way they do in the browser.
//   - In `pnpm run dev`, the request hits the dev server's catch-all
//     proxy and forwards to pact-gateway exactly like a browser fetch
//     would. No code path divergence between client and server.
//
// Browser callers should keep using relative paths — they already
// resolve against location.origin and the proxy / MSW handle them.
//
// No consumers in pact-web yet (Server Components currently use gRPC,
// not fetch). Added now so the first Server Component fetch picks up
// the right convention from day one.
export const getApiBaseUrl = (): string => {
  const port = process.env.PORT ?? '3000';

  return `http://localhost:${port}`;
};

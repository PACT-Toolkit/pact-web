import { isMock } from '@/src/framework/helpers/environment';
import { mswReady } from '@/src/framework/msw/msw_ready';

// PACT-455: delays every outgoing `fetch()` call until `mswReady` resolves
// (see msw_ready.ts for why that's needed). This covers the orval-generated
// REST hooks - `client: 'swr'` in orval.config.ts means the generated
// fetchers call the global `fetch` directly, and being generated code they
// can't be hand-edited to await a readiness gate themselves - plus any
// other first-party code that calls `fetch` directly (e.g. auth forms).
// `httpClient` (axios) requests are gated separately via a request
// interceptor in src/framework/http/axios.ts, since axios's browser adapter
// uses XMLHttpRequest rather than `fetch`.
//
// Must be called from module scope (not inside a `useEffect`) so the patch
// is installed while the app's client bundle is first evaluated - before
// hydration commits and any component's effects (including MSWProvider's
// own `init()` call) can fire a request. See msw_provider.tsx.
let installed = false;

export function installFetchGate(): void {
  if (installed || typeof window === 'undefined' || !isMock()) return;
  installed = true;

  const realFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    await mswReady;

    return realFetch(...args);
  };
}

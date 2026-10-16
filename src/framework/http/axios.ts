import axios from 'axios';

import { mswReady } from '@/src/framework/msw/msw_ready';

// Centralised HTTP client for all PACT backend calls.
// - No baseURL: callers use full paths (/api/pact/... or /v1/...) for clarity.
// - 401 redirect: unauthenticated responses send the user to /login.
// - Do NOT use for Next.js API routes (/api/auth/*), external APIs, or S3
//   presigned URLs - those have different auth semantics.
export const httpClient = axios.create({
  headers: { 'Content-Type': 'application/json' },
});

// axios's browser adapter uses XMLHttpRequest rather than
// `fetch`, so it isn't covered by the global fetch gate in
// msw_fetch_gate.ts. Await the same `mswReady` signal here so httpClient
// calls (TestLabWorkbench, DashboardQuickProbe, FilesWorkbench) can't slip
// past the mock service worker during its startup window either. Resolves
// immediately outside of dev:mock, so this is a no-op everywhere else.
httpClient.interceptors.request.use(async (config) => {
  await mswReady;

  return config;
});

httpClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      typeof window !== 'undefined'
    ) {
      // Preserve the page the user was on so /login can send them back
      // after signing in, instead of always landing on the default
      // post-login destination.
      const returnTo = `${window.location.pathname}${window.location.search}`;
      const loginUrl = new URL('/login', window.location.origin);
      loginUrl.searchParams.set('return_to', returnTo);
      window.location.href = loginUrl.href;
    }

    return Promise.reject(error);
  }
);

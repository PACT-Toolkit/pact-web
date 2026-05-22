// Browser-side bootstrap. Called from MSWProvider on mount.
// The Node-runtime side is started by instrumentation.ts so that
// Server Components and route handlers also see mocked responses.
export async function init() {
  if (typeof window !== 'undefined') {
    const { worker } = await import('./browser');
    await worker.start({
      onUnhandledRequest:
        process.env.NEXT_PUBLIC_MSW_DEBUG === 'true' ? 'warn' : 'bypass',
      quiet: process.env.NEXT_PUBLIC_MSW_DEBUG !== 'true',
      // Pin the service-worker file to the path Next.js serves it from
      // (public/mockServiceWorker.js). Explicit is better than relying on
      // MSW's default — moving the file later won't silently 404.
      serviceWorker: { url: '/mockServiceWorker.js' },
      // Block the first navigation until the worker has installed so the
      // earliest fetches can't slip past MSW and hit the real backend.
      waitUntilReady: true,
    });
    if (process.env.NEXT_PUBLIC_MSW_DEBUG === 'true') {
      // @ts-expect-error -- exposing worker on window for MSW debug
      window.worker = worker;
    }
  }
}

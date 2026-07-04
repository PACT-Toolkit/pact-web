import { isCommonAssetRequest } from 'msw';

// Browser-side bootstrap. Called from MSWProvider on mount.
// The Node-runtime side is started by instrumentation.ts so that
// Server Components and route handlers also see mocked responses.
export async function init() {
  if (typeof window !== 'undefined') {
    const { worker } = await import('./browser');
    await worker.start({
      onUnhandledRequest:
        process.env.NEXT_PUBLIC_MSW_DEBUG === 'true'
          ? (request, print) => {
              // The MSW browser worker always arms its WebSocketInterceptor,
              // so Next's own dev infrastructure - the HMR websocket
              // (/_next/webpack-hmr) and other /_next/* internals - gets
              // routed through here too. That's not API surface a mock
              // should ever cover, and warning about it just trains
              // developers to ignore MSW debug output. Stay silent for it.
              //
              // Using a callback here bypasses MSW's built-in
              // isCommonAssetRequest() filter (it only runs for the plain
              // 'warn'/'bypass' string strategies, not for a function
              // strategy - see msw's onUnhandledRequest.js), so we re-apply
              // it ourselves to avoid newly warning on common static
              // assets (fonts, images, etc.) that 'warn' used to bypass
              // silently.
              const pathname = new URL(request.url).pathname;
              if (
                pathname.startsWith('/_next/') ||
                isCommonAssetRequest(request)
              ) {
                return;
              }
              print.warning();
            }
          : 'bypass',
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

export async function init() {
  if (typeof window !== 'undefined') {
    const { worker } = await import('./browser');
    await worker.start({
      onUnhandledRequest:
        process.env.NEXT_PUBLIC_MSW_DEBUG === 'true' ? 'warn' : 'bypass',
      quiet: process.env.NEXT_PUBLIC_MSW_DEBUG !== 'true',
      waitUntilReady: true,
    });
    if (process.env.NEXT_PUBLIC_MSW_DEBUG === 'true') {
      // @ts-expect-error -- exposing worker on window for MSW debug
      window.worker = worker;
    }
  }
}

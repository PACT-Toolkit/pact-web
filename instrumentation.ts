// Boots MSW in the Node runtime when `pnpm run dev:mock` is active so
// Server Components and route handlers get intercepted the same way the
// browser worker handles client-side fetches. Without this, anything
// running on the server bypasses MSW and hits the real backend.
//
// Mirrors lunar/terra-web's pattern: the `mocks/server.ts` module is the
// same one vitest.setup.ts already uses for unit tests.

export async function register() {
  if (
    process.env.NEXT_RUNTIME === 'nodejs' &&
    process.env.NEXT_PUBLIC_API_MOCKING === 'enabled'
  ) {
    const { server } = await import('@/mocks/server');
    server.listen({
      onUnhandledRequest:
        process.env.NEXT_PUBLIC_MSW_DEBUG === 'true' ? 'warn' : 'bypass',
    });
  }
}

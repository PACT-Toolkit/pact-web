export { MSWProvider } from './msw_provider';

// Glob prefix for MSW handlers that intercept browser fetches routed through
// the Next.js /api/pact/[...path] proxy. Use this instead of repeating the
// literal so a path mismatch is caught in one place.
export const MSW_PACT_BASE = '*/api/pact';

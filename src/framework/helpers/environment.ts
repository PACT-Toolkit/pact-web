export const isLocalDevelopment = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'development';

export const isPreview = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'preview';

export const isProduction = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'production';

export const isMock = () => process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

export const isDemo = () => process.env.NEXT_PUBLIC_IS_DEMO_ENV === 'true';

// Stable mock user identity used across the dev:mock surface — MSW handlers
// resolve to this id, and validateSessionFromCookies() returns a synthetic
// session bound to it so the login flow is skipped. Production never sees
// this value; pact-auth.ValidateSession is the real source of identity.
export const MOCK_USER_ID = '8f5c4d12-1d50-4c18-8ad3-2f4f64a4f111';

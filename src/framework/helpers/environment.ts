export const isLocalDevelopment = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'development';

export const isPreview = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'preview';

export const isProduction = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'production';

export const isMock = () => process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

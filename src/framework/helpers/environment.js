const isLocalDevelopment = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'development';

const isPreview = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'preview';

const isProduction = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENVIRONMENT === 'production';

const isMock = () => process.env.NEXT_PUBLIC_API_MOCKING === 'enabled';

module.exports = {
  isLocalDevelopment,
  isPreview,
  isProduction,
  isMock,
};

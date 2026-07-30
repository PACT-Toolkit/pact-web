// Shared base attributes for pact-web's httpOnly auth cookies (pact_session,
// pact_refresh_token). Extracted so both the auth framework's cookie
// builders (src/framework/auth/pact_auth/cookies.ts) and the gateway proxy's
// own cookie-rotation logic (src/lib/proxy/proxy_to_gateway.ts) share one
// definition instead of hand-duplicating the attribute set. Lives in
// src/lib rather than the framework folder for the same reason
// SESSION_COOKIE does (see src/lib/session_cookie.ts): the proxy sits in the
// lib layer and the ESLint boundaries config forbids lib -> framework
// imports, so anything both layers need to share has to live here.
export const authCookieBaseOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
});

// Name of the httpOnly session cookie the /api/auth/* routes write and
// every server-side layer reads (session validation, factor lookups, the
// gateway proxy). Defined in src/lib rather than the auth framework
// folder because the gateway proxy (src/lib/proxy) must read it too and
// the lib layer cannot import framework modules; the auth framework
// re-exports it from cookies.ts so auth code keeps one import site.
export const SESSION_COOKIE = 'pact_session';

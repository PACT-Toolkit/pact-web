// Name of the httpOnly session cookie the /api/auth/* routes write and
// every server-side layer reads (session validation, factor lookups, the
// gateway proxy). Defined in src/lib rather than the auth framework
// folder because the gateway proxy (src/lib/proxy) must read it too and
// the lib layer cannot import framework modules; the auth framework
// re-exports it from cookies.ts so auth code keeps one import site.
export const SESSION_COOKIE = 'pact_session';

// Name of the httpOnly refresh-token cookie the same routes write alongside
// SESSION_COOKIE, and that the gateway proxy attaches as the
// X-Pact-Refresh-Token request header on every proxied call so
// pact-gateway's authMiddleware can silently rotate the session pair before
// the short-lived session token expires (PACT-705). Same layering
// rationale as SESSION_COOKIE above.
export const REFRESH_TOKEN_COOKIE = 'pact_refresh_token';

// The refresh token itself has no fixed expiry pact-web can read off a
// response - it's single-use and stays valid until pact-auth's underlying
// session goes idle or hits its absolute cap (SESSION_IDLE_TTL_HOURS,
// default 168h/7d as of PACT-727; see pact-auth/internal/app/config.go). We
// can't mirror the short-lived session token's own expiry here - that would
// make the refresh cookie vanish almost as fast as the session token it
// exists to renew, defeating the point of PACT-705/PACT-726 for anyone who
// returns after the token TTL but before the session itself goes idle.
// Instead the cookie caps out at the idle-TTL default and slides forward on
// every write (initial login, every rotation the gateway proxy performs,
// and every silent renewal proxy.ts performs on page navigation) because
// callers set it with maxAge, not a fixed expires. Defined here (rather
// than only in the auth framework) because the gateway proxy also needs
// it to rotate the cookie and the lib layer cannot import framework
// modules.
//
// Kept in lockstep with pact-auth's SESSION_IDLE_TTL_HOURS default - bumping
// one without the other either strands users at the shorter of the two
// (cookie survives but pact-auth already reaped the session) or lets the
// cookie outlive a session that's already gone (harmless - a dead refresh
// token just fails at redemption time - but pointless to widen further than
// the value it fronts).
export const REFRESH_TOKEN_COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

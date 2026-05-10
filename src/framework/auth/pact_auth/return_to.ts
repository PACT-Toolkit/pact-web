import 'server-only';

import { type NextRequest } from 'next/server';

// Returns the inbound request's origin (`scheme://host[:port]`), respecting
// `x-forwarded-*` for prod-style reverse proxies and the `Host` header for
// dev. Next.js's `req.nextUrl.origin` is unreliable here — in dev it's
// sticky to whatever the listener was started with, not the actual Host
// on the wire.
export const requestOrigin = (req: NextRequest): string => {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost ?? req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto');
  const proto = forwardedProto ?? req.nextUrl.protocol.replace(/:$/, '');
  if (host) return `${proto}://${host}`;

  return req.nextUrl.origin;
};

// Default post-auth redirect target. Derived from `requestOrigin` so the
// same handler works for `localhost:3000` AND for the dev box's LAN IP —
// clicking a verify link from a phone on the same WiFi lands back on the
// LAN URL the phone can reach, not localhost (which would resolve to the
// phone itself).
//
// `PACT_AUTH_DEFAULT_RETURN_TO` always wins when set: in prod we want a
// canonical URL that doesn't drift per request. NOTE: when the env var
// is set the `path` argument is ignored — every caller gets the same
// final URL regardless of what they passed. All current callers default
// to `/dashboard` so this is fine in practice; if a future caller
// genuinely needs a different post-auth destination, switch to
// `PACT_AUTH_DEFAULT_RETURN_TO_ORIGIN` semantics here so origin and
// path can be composed.
export const defaultReturnTo = (
  req: NextRequest,
  path = '/dashboard'
): string => {
  const explicit = process.env.PACT_AUTH_DEFAULT_RETURN_TO;
  if (explicit) return explicit;

  return `${requestOrigin(req)}${path}`;
};

// Rebases an absolute or relative `return_to` (as echoed back by
// pact-auth) onto the inbound request's origin. The path + query are
// preserved verbatim. This is what makes "register on laptop, click the
// verify email on a phone" work end-to-end in dev: pact-auth stored the
// laptop's origin, but the phone is the device that needs to land
// somewhere it can reach.
//
// SECURITY: this rebase is **dev-only by default**. In production we
// trust pact-auth's allowlist over the inbound `Host` header — a
// malicious upstream sending `Host: evil.example` would otherwise turn
// every post-auth redirect into a phishing target. Outside dev we use
// the URL pact-auth gave us as-is (it has already been canonicalized
// against `PACT_OAUTH_RETURN_TO_ALLOWLIST`).
//
// Operators who explicitly want the dev convenience in another
// environment can set `PACT_AUTH_REBASE_RETURN_TO=1`. Don't do this if
// your reverse proxy / CDN doesn't sanitize the `Host` header.
export const rebaseReturnTo = (req: NextRequest, returnTo: string): URL => {
  const allowed =
    process.env.NODE_ENV === 'development' ||
    process.env.PACT_AUTH_REBASE_RETURN_TO === '1';

  if (!allowed) {
    try {
      return new URL(returnTo);
    } catch {
      // Stored URL was relative — resolve against the inbound origin as
      // a last resort. pact-auth never stores relative URLs today, but
      // the fallback keeps the function total.
      return new URL(returnTo, requestOrigin(req));
    }
  }

  const origin = requestOrigin(req);
  let pathAndQuery: string;
  try {
    const stored = new URL(returnTo);
    pathAndQuery = stored.pathname + stored.search;
  } catch {
    pathAndQuery = returnTo.startsWith('/') ? returnTo : `/${returnTo}`;
  }

  return new URL(pathAndQuery, origin);
};

// End-user client IP extraction and forwarding, shared by every module
// that talks to pact-gateway on pact-web's behalf (the auth REST client,
// the generic gateway edge proxy). See PACT-687: pact-gateway keys its
// per-IP rate buckets on the right-most trusted X-Forwarded-For hop
// (internal/boundary/boundary.go, trustedProxyHops=1 in
// internal/app/server.go), and pact-web is that one trusted hop. Without
// this, every end user collapses onto pact-web's own egress IP on the
// gateway side.

// Resolves the end-user's IP from an inbound request's headers, as
// delivered by pact-web's fronting platform. Prefers the right-most entry
// of X-Forwarded-For (the platform's own trusted annotation of the real
// client, appended after any chain further upstream) and falls back to
// X-Real-IP when X-Forwarded-For is absent. Returns undefined when
// neither header is present - callers must treat that as "no client IP
// to forward", not an error.
export const inboundClientIp = (headers: Headers): string | undefined => {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const hops = xff
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    const rightmost = hops.at(-1);
    if (rightmost) return rightmost;
  }

  return headers.get('x-real-ip') ?? undefined;
};

// Appends exactly one hop to an outbound X-Forwarded-For chain - never
// replaces an existing value. This is the single-hop-append pact-gateway's
// trustedProxyHops=1 parsing assumes: the gateway reads only the
// right-most entry of what pact-web sends, so that entry must be the
// value pact-web itself appended, not a value some deeper caller already
// set. Returns undefined when there is nothing to forward and nothing
// already present.
export const appendForwardedFor = (
  existing: string | null | undefined,
  clientIp: string | undefined
): string | undefined => {
  if (!clientIp) return existing ?? undefined;

  return existing ? `${existing}, ${clientIp}` : clientIp;
};

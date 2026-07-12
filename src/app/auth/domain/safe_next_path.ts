// Validates the `next` param on /verify-email/success. The page lives
// at a same-origin URL set by /api/auth/verify-email after a successful
// token exchange, but the param is in plain query string and could be
// hand-crafted by an attacker into an open-redirect link. We accept
// only same-origin paths (must start with "/", must not start with
// "//" or "/\\" which browsers treat as protocol-relative).
//
// Anything else falls back to /dashboard, which matches the behaviour
// of the rest of the auth flow when no return_to is configured.
const FALLBACK = '/dashboard';

export const safeNextPath = (raw: string | string[] | undefined): string => {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return FALLBACK;
  if (!value.startsWith('/')) return FALLBACK;
  if (value.startsWith('//') || value.startsWith('/\\')) return FALLBACK;

  return value;
};

// Status classifiers for the shape the orval-generated fetchers resolve
// with, and for the thrown Axios-shaped errors that wrap the same status.
//
// The generated fetcher (see __codegen__/rest/custom_fetch.ts) never throws
// on a non-2xx response -- every status, including 403, resolves normally as
// `{ data, status, headers }` -- so the primary signal is the resolved
// `status`, not SWR's `error`. The `response.status` branch of
// isForbiddenError is the thrown Axios-shaped error: it covers a caller
// passing the value to SWR's onErrorRetry (which receives whatever the
// fetcher throws) or a hand-written request that rejects.

const FORBIDDEN_STATUS = 403;

// True for a resolved response with status 403 or a thrown Axios-shaped error
// whose `response.status` is 403 -- the permission gate (for example
// audit:stats), a stable outcome rather than a transient failure.
export const isForbiddenError = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  const status = (value as { status?: unknown }).status;
  if (status === FORBIDDEN_STATUS) return true;

  const response = (value as { response?: { status?: unknown } }).response;

  return response?.status === FORBIDDEN_STATUS;
};

// True for a resolved response whose status is neither a success (any 2xx)
// nor the permission gate that isForbiddenError already classifies -- for
// example a stale bearer racing a session rotation coming back 401, or a 5xx.
// Without it such a response normalises to an all-zero payload that looks
// like real data. `value` is the resolved fetcher shape, not SWR's thrown
// `error`: callers OR this with `Boolean(error)` to also catch a genuinely
// thrown fetch.
export const isNonForbiddenFailure = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false;

  const status = (value as { status?: unknown }).status;
  if (typeof status !== 'number') return false;

  const ok = status >= 200 && status < 300;

  return !ok && status !== FORBIDDEN_STATUS;
};

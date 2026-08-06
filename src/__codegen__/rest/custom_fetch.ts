/**
 * Auto-generated shared fetch for every orval-generated client (wired in as
 * the orval `override.mutator`).
 * Do not edit manually - the template lives in scripts/rest-codegen.mjs;
 * run `pnpm rest:codegen` to regenerate.
 */

/**
 * Body decoding is content-type-aware: JSON.parse runs only when the
 * response declares a JSON media type. The real gateway returns text/plain
 * authz errors ("missing required permission"), which an unconditional
 * JSON.parse turns into a thrown SyntaxError, masking the resolved 403
 * from permission gates like isDecisionStatsForbidden (PACT-737).
 * A declared-JSON body that fails to parse still resolves as raw text
 * instead of throwing, so proxy-injected error pages cannot crash a
 * query either.
 */
const parseBody = (contentType: string | null, body: string): unknown => {
  if (!contentType?.toLowerCase().includes('json')) return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
};

/**
 * Behavior contract, relied on by consumers such as
 * src/app/audit/domain/audit_decision_stats_access.ts:
 * customFetch never throws on HTTP status - every response, non-2xx
 * included, resolves as `{ data, status, headers }`.
 */
export const customFetch = async <T>(
  url: string,
  options: RequestInit
): Promise<T> => {
  const res = await fetch(url, options);

  const body = [204, 205, 304].includes(res.status) ? null : await res.text();
  const data = body ? parseBody(res.headers.get('content-type'), body) : {};

  return { data, status: res.status, headers: res.headers } as T;
};

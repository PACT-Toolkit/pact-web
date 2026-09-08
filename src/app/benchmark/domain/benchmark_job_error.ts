/** Operator-readable description of a terminal benchmark job's `error` field. */
export interface BenchmarkJobErrorDescription {
  title: string;
  detail?: string;
  code: string | null;
}

interface BenchmarkJobErrorCopy {
  title: string;
  detail: string;
}

// pact-benchmark's typed job-failure codes (pact_benchmark/domain/types.py),
// each with one plain sentence on what happened and one on what to do next.
// Every other job failure is free text (`str(exc)`, not a machine code) and
// is handled by the fallback branch in describeJobError below - extend this
// table only when pact-benchmark adds a sibling to AUTH_TOKEN_EXPIRED.
const JOB_ERROR_COPY: Record<string, BenchmarkJobErrorCopy> = {
  auth_token_expired: {
    title: 'Your session expired before the run finished.',
    detail:
      'Sign in again and re-run the job. Rows already checked are not kept.',
  },
};

/**
 * Maps a benchmark job's terminal `error` field to operator-readable copy.
 * Known machine codes (see JOB_ERROR_COPY) get a title, an explanatory
 * detail, and the raw code preserved separately for support. Unknown codes
 * and free-text errors (the majority - most failures are `str(exc)`) fall
 * back to the raw string unchanged as the title, with `code` left null since
 * there is nothing additional to show alongside it.
 */
export const describeJobError = (
  code: string | null | undefined
): BenchmarkJobErrorDescription => {
  if (!code) {
    return { title: '', code: null };
  }

  const known = JOB_ERROR_COPY[code];
  if (known) {
    return { title: known.title, detail: known.detail, code };
  }

  return { title: code, code: null };
};

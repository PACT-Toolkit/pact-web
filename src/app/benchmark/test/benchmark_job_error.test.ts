import { describe, expect, it } from 'vitest';

import { describeJobError } from '@/src/app/benchmark/domain/benchmark_job_error';

describe('describeJobError', () => {
  it('maps auth_token_expired to operator-readable copy and keeps the raw code', () => {
    const result = describeJobError('auth_token_expired');

    expect(result.title).toBe('Your session expired before the run finished.');
    expect(result.detail).toBe(
      'Sign in again and re-run the job. Rows already checked are not kept.'
    );
    expect(result.code).toBe('auth_token_expired');
  });

  it('falls back to the raw string for an unknown code, with no separate code', () => {
    const result = describeJobError('corpus row 12 failed to parse');

    expect(result.title).toBe('corpus row 12 failed to parse');
    expect(result.detail).toBeUndefined();
    expect(result.code).toBeNull();
  });

  it('returns an empty title and null code for a missing error', () => {
    expect(describeJobError(null)).toEqual({ title: '', code: null });
    expect(describeJobError(undefined)).toEqual({ title: '', code: null });
    expect(describeJobError('')).toEqual({ title: '', code: null });
  });
});

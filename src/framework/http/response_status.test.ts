import { describe, expect, it } from 'vitest';

import {
  isForbiddenError,
  isNonForbiddenFailure,
} from '@/src/framework/http/response_status';

describe('isForbiddenError', () => {
  it('is true for a resolved response with status 403', () => {
    expect(isForbiddenError({ status: 403, data: {} })).toBe(true);
  });

  it('is true for a thrown Axios-shaped error with response.status 403', () => {
    expect(isForbiddenError({ response: { status: 403 } })).toBe(true);
  });

  it('is false for a 200 response', () => {
    expect(isForbiddenError({ status: 200, data: {} })).toBe(false);
  });

  it('is false for other error statuses (400, 401, 429, 500)', () => {
    expect(isForbiddenError({ status: 400, data: {} })).toBe(false);
    expect(isForbiddenError({ status: 401, data: {} })).toBe(false);
    expect(isForbiddenError({ status: 429, data: {} })).toBe(false);
    expect(isForbiddenError({ response: { status: 500 } })).toBe(false);
  });

  it('is false for an error with no status at all', () => {
    expect(isForbiddenError(new Error('network error'))).toBe(false);
    expect(isForbiddenError({ response: {} })).toBe(false);
  });

  it('is false for undefined, null, and non-object values', () => {
    expect(isForbiddenError(undefined)).toBe(false);
    expect(isForbiddenError(null)).toBe(false);
    expect(isForbiddenError('403')).toBe(false);
    expect(isForbiddenError(403)).toBe(false);
  });
});

describe('isNonForbiddenFailure', () => {
  it('is false for 200', () => {
    expect(isNonForbiddenFailure({ status: 200, data: {} })).toBe(false);
  });

  it('is false for other 2xx statuses', () => {
    expect(isNonForbiddenFailure({ status: 204, data: {} })).toBe(false);
    expect(isNonForbiddenFailure({ status: 201, data: {} })).toBe(false);
  });

  it('is false for 403 (the permission gate isForbiddenError classifies)', () => {
    expect(isNonForbiddenFailure({ status: 403, data: {} })).toBe(false);
  });

  it('is true for a stale-bearer 401 racing a session rotation', () => {
    expect(isNonForbiddenFailure({ status: 401, data: {} })).toBe(true);
  });

  it('is true for a 429 and a 5xx', () => {
    expect(isNonForbiddenFailure({ status: 429, data: {} })).toBe(true);
    expect(isNonForbiddenFailure({ status: 500, data: {} })).toBe(true);
  });

  it('is true at the 2xx boundaries (199 and 300)', () => {
    expect(isNonForbiddenFailure({ status: 199 })).toBe(true);
    expect(isNonForbiddenFailure({ status: 300 })).toBe(true);
  });

  it('is false for undefined, null, non-object, and non-numeric status', () => {
    expect(isNonForbiddenFailure(undefined)).toBe(false);
    expect(isNonForbiddenFailure(null)).toBe(false);
    expect(isNonForbiddenFailure('401')).toBe(false);
    expect(isNonForbiddenFailure({ status: '401', data: {} })).toBe(false);
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  RATE_LIMIT_MAX_DELAY_MS,
  parseRetryAfterMs,
  rateLimitDelayMs,
  retryOnRateLimit,
} from '@/src/framework/http/rate_limit_retry';

// 2026-10-18T12:00:00Z
const NOW_MS = Date.UTC(2026, 9, 18, 12, 0, 0);

describe('parseRetryAfterMs', () => {
  it('reads delta-seconds as milliseconds', () => {
    expect(parseRetryAfterMs('0', NOW_MS)).toBe(0);
    expect(parseRetryAfterMs('7', NOW_MS)).toBe(7000);
    expect(parseRetryAfterMs('  7  ', NOW_MS)).toBe(7000);
  });

  it('reads an HTTP-date as the time remaining until it', () => {
    expect(parseRetryAfterMs('Sun, 18 Oct 2026 12:00:09 GMT', NOW_MS)).toBe(
      9000
    );
  });

  it('reads the obsolete RFC 850 date form', () => {
    expect(parseRetryAfterMs('Sunday, 18-Oct-26 12:00:05 GMT', NOW_MS)).toBe(
      5000
    );
  });

  it('gives 0 for an HTTP-date that is already in the past', () => {
    expect(parseRetryAfterMs('Sun, 18 Oct 2026 11:00:00 GMT', NOW_MS)).toBe(0);
  });

  it('clamps huge delta-seconds and far-future dates to the maximum', () => {
    expect(parseRetryAfterMs('86400', NOW_MS)).toBe(RATE_LIMIT_MAX_DELAY_MS);
    expect(parseRetryAfterMs('9'.repeat(400), NOW_MS)).toBe(
      RATE_LIMIT_MAX_DELAY_MS
    );
    expect(parseRetryAfterMs('Mon, 18 Oct 2027 12:00:00 GMT', NOW_MS)).toBe(
      RATE_LIMIT_MAX_DELAY_MS
    );
  });

  it('is undefined for a missing or empty header', () => {
    expect(parseRetryAfterMs(undefined, NOW_MS)).toBeUndefined();
    expect(parseRetryAfterMs(null, NOW_MS)).toBeUndefined();
    expect(parseRetryAfterMs('', NOW_MS)).toBeUndefined();
    expect(parseRetryAfterMs('   ', NOW_MS)).toBeUndefined();
  });

  it('is undefined for negative, fractional, and non-numeric values', () => {
    expect(parseRetryAfterMs('-5', NOW_MS)).toBeUndefined();
    expect(parseRetryAfterMs('1.5', NOW_MS)).toBeUndefined();
    expect(parseRetryAfterMs('1e3', NOW_MS)).toBeUndefined();
    expect(parseRetryAfterMs('soon', NOW_MS)).toBeUndefined();
    expect(parseRetryAfterMs('Not, a date', NOW_MS)).toBeUndefined();
  });
});

describe('rateLimitDelayMs', () => {
  it('prefers a parsable Retry-After over the computed back-off', () => {
    expect(
      rateLimitDelayMs({ attempt: 5, retryAfter: '2', baseDelayMs: 500 })
    ).toBe(2000);
  });

  it('doubles the base delay per attempt without a Retry-After', () => {
    const delays = [0, 1, 2, 3].map((attempt) =>
      rateLimitDelayMs({ attempt, baseDelayMs: 500 })
    );

    expect(delays).toEqual([500, 1000, 2000, 4000]);
  });

  it('falls back to the back-off for an unparsable Retry-After', () => {
    expect(
      rateLimitDelayMs({ attempt: 1, retryAfter: 'later', baseDelayMs: 500 })
    ).toBe(1000);
  });

  it('caps the computed back-off at the maximum', () => {
    expect(rateLimitDelayMs({ attempt: 40, baseDelayMs: 500 })).toBe(
      RATE_LIMIT_MAX_DELAY_MS
    );
    expect(rateLimitDelayMs({ attempt: 0, baseDelayMs: 10 ** 9 })).toBe(
      RATE_LIMIT_MAX_DELAY_MS
    );
  });

  it('treats a negative attempt as the first attempt', () => {
    expect(rateLimitDelayMs({ attempt: -3, baseDelayMs: 500 })).toBe(500);
  });
});

describe('retryOnRateLimit', () => {
  const rateLimited = (retryAfter?: string) =>
    Object.assign(new Error('rate limited'), { status: 429, retryAfter });

  it('returns the result without sleeping when nothing fails', async () => {
    const operation = vi.fn().mockResolvedValue('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(retryOnRateLimit(operation, { sleep })).resolves.toBe('ok');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a 429 with exponential delays and then succeeds', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(rateLimited())
      .mockRejectedValueOnce(rateLimited())
      .mockResolvedValueOnce('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(retryOnRateLimit(operation, { sleep })).resolves.toBe('ok');
    expect(operation).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[500], [1000]]);
  });

  it('sleeps for the Retry-After of the error when it has one', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(rateLimited('4'))
      .mockResolvedValueOnce('ok');
    const sleep = vi.fn().mockResolvedValue(undefined);

    await retryOnRateLimit(operation, { sleep });

    expect(sleep.mock.calls).toEqual([[4000]]);
  });

  it('rethrows a non-429 error without retrying', async () => {
    const failure = Object.assign(new Error('boom'), { status: 500 });
    const operation = vi.fn().mockRejectedValue(failure);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(retryOnRateLimit(operation, { sleep })).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('rethrows an error that is not an object without retrying', async () => {
    const operation = vi.fn().mockRejectedValue('plain string');
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(retryOnRateLimit(operation, { sleep })).rejects.toBe(
      'plain string'
    );
    expect(sleep).not.toHaveBeenCalled();
  });

  it('gives up with the 429 error once maxRetries retries are used', async () => {
    const failure = rateLimited();
    const operation = vi.fn().mockRejectedValue(failure);
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryOnRateLimit(operation, { maxRetries: 3, sleep })
    ).rejects.toBe(failure);
    expect(operation).toHaveBeenCalledTimes(4);
    expect(sleep).toHaveBeenCalledTimes(3);
  });

  it('never retries when maxRetries is 0', async () => {
    const operation = vi.fn().mockRejectedValue(rateLimited());
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryOnRateLimit(operation, { maxRetries: 0, sleep })
    ).rejects.toMatchObject({ status: 429 });
    expect(operation).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('keeps every sleep within the shared maximum', async () => {
    const operation = vi.fn().mockRejectedValue(rateLimited('3600'));
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      retryOnRateLimit(operation, { maxRetries: 2, sleep })
    ).rejects.toMatchObject({ status: 429 });
    expect(sleep.mock.calls).toEqual([
      [RATE_LIMIT_MAX_DELAY_MS],
      [RATE_LIMIT_MAX_DELAY_MS],
    ]);
  });
});

import { describe, expect, it, vi } from 'vitest';

import {
  decisionStatsPollingConfig,
  isDecisionStatsFailure,
  isDecisionStatsForbidden,
} from '@/src/app/audit/domain/audit_decision_stats_access';

describe('isDecisionStatsForbidden', () => {
  it('is true for a resolved response with status 403', () => {
    expect(isDecisionStatsForbidden({ status: 403, data: {} })).toBe(true);
  });

  it('is true for a thrown Axios-shaped error with response.status 403', () => {
    expect(isDecisionStatsForbidden({ response: { status: 403 } })).toBe(true);
  });

  it('is false for a 200 response', () => {
    expect(isDecisionStatsForbidden({ status: 200, data: {} })).toBe(false);
  });

  it('is false for other error statuses (400, 401)', () => {
    expect(isDecisionStatsForbidden({ status: 400, data: {} })).toBe(false);
    expect(isDecisionStatsForbidden({ status: 401, data: {} })).toBe(false);
  });

  it('is false for undefined, null, and non-object values', () => {
    expect(isDecisionStatsForbidden(undefined)).toBe(false);
    expect(isDecisionStatsForbidden(null)).toBe(false);
    expect(isDecisionStatsForbidden('403')).toBe(false);
    expect(isDecisionStatsForbidden(403)).toBe(false);
  });
});

// PACT-914: isDecisionStatsFailure originally treated any non-200,
// non-403 status as a failure, which mislabeled a non-200 success status
// (e.g. 204) as a failure. It now accepts any 2xx as success.
describe('isDecisionStatsFailure', () => {
  it('is false for 200', () => {
    expect(isDecisionStatsFailure({ status: 200, data: {} })).toBe(false);
  });

  it('is false for other 2xx statuses', () => {
    expect(isDecisionStatsFailure({ status: 204, data: {} })).toBe(false);
    expect(isDecisionStatsFailure({ status: 201, data: {} })).toBe(false);
  });

  it('is false for 403 (the already-handled permission gate)', () => {
    expect(isDecisionStatsFailure({ status: 403, data: {} })).toBe(false);
  });

  it('is true for a stale-bearer 401 racing a session rotation', () => {
    expect(isDecisionStatsFailure({ status: 401, data: {} })).toBe(true);
  });

  it('is true for a 5xx', () => {
    expect(isDecisionStatsFailure({ status: 500, data: {} })).toBe(true);
  });

  it('is false for undefined, null, non-object, and non-numeric status', () => {
    expect(isDecisionStatsFailure(undefined)).toBe(false);
    expect(isDecisionStatsFailure(null)).toBe(false);
    expect(isDecisionStatsFailure('401')).toBe(false);
    expect(isDecisionStatsFailure({ status: '401', data: {} })).toBe(false);
  });
});

// Minimal stand-in for the `Readonly<PublicConfiguration<...>>` third
// argument SWR passes to onErrorRetry -- only the two fields the
// implementation reads (errorRetryCount, errorRetryInterval).
type RetryConfig = Parameters<
  NonNullable<ReturnType<typeof decisionStatsPollingConfig>['onErrorRetry']>
>[2];

const retryConfig = (
  overrides: Partial<{ errorRetryCount: number; errorRetryInterval: number }>
): RetryConfig =>
  ({
    errorRetryInterval: 5_000,
    ...overrides,
  }) as RetryConfig;

describe('decisionStatsPollingConfig', () => {
  it('disables refreshInterval once the latest response is a 403', () => {
    const { refreshInterval } = decisionStatsPollingConfig(30_000);
    if (typeof refreshInterval !== 'function') {
      throw new Error('refreshInterval must be a function');
    }

    const okStats = {
      total: 0,
      latest_at_unix: 0,
      filter: {
        flagged: 0,
        blocked: 0,
        block_rate: 0,
        top_rule_id: '',
        suspicious: 0,
        hostile: 0,
        top_rules: [],
      },
      classifier: {
        responded: 0,
        tagged: 0,
        top_label: '',
        avg_tagged_score: 0,
        consensus: 0,
        labels: [],
      },
      redactor: { redacted: 0, spans: 0, redaction_rate: 0, span_labels: [] },
    };

    expect(
      refreshInterval({ status: 200, data: okStats, headers: new Headers() })
    ).toBe(30_000);
    expect(
      refreshInterval({
        status: 403,
        data: 'nope',
        headers: new Headers(),
      })
    ).toBe(0);
    expect(refreshInterval(undefined)).toBe(30_000);
  });

  it('bails out of onErrorRetry without scheduling a retry on a 403-shaped error', () => {
    vi.useFakeTimers();
    try {
      const { onErrorRetry } = decisionStatsPollingConfig(30_000);
      const revalidate = vi.fn();

      onErrorRetry?.(
        { response: { status: 403 } },
        '/v1/audit/stats',
        retryConfig({}),
        revalidate,
        { retryCount: 0, dedupe: true }
      );

      vi.advanceTimersByTime(60_000);
      expect(revalidate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('schedules a retry for a non-403 error, honoring config.errorRetryInterval', () => {
    vi.useFakeTimers();
    try {
      const { onErrorRetry } = decisionStatsPollingConfig(30_000);
      const revalidate = vi.fn();

      onErrorRetry?.(
        new Error('network error'),
        '/v1/audit/stats',
        retryConfig({}),
        revalidate,
        { retryCount: 0, dedupe: true }
      );

      expect(revalidate).not.toHaveBeenCalled();
      vi.advanceTimersByTime(5_000);
      expect(revalidate).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops retrying once retryCount exceeds config.errorRetryCount', () => {
    vi.useFakeTimers();
    try {
      const { onErrorRetry } = decisionStatsPollingConfig(30_000);
      const revalidate = vi.fn();

      onErrorRetry?.(
        new Error('network error'),
        '/v1/audit/stats',
        retryConfig({ errorRetryCount: 2 }),
        revalidate,
        { retryCount: 3, dedupe: true }
      );

      vi.advanceTimersByTime(60_000);
      expect(revalidate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

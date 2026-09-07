import { describe, expect, it } from 'vitest';

import {
  describeBenchmarkJobPoll,
  nextBenchmarkJobPollDelayMs,
} from '@/src/app/benchmark/domain/benchmark_job_poll';

// Minimal fixtures matching the resolved shape customFetch always returns:
// `{ data, status, headers }`, never a thrown error - see
// src/__codegen__/rest/custom_fetch.ts.
const runningResponse = (overrides: { status?: string } = {}) => ({
  status: 200 as const,
  data: {
    status: overrides.status ?? 'running',
    progress_pct: 40,
  },
  headers: new Headers(),
});

const httpError = (status: number) => ({
  status,
  data: 'error body',
  headers: new Headers(),
});

describe('describeBenchmarkJobPoll', () => {
  it('is polling when there is no response yet', () => {
    expect(describeBenchmarkJobPoll(undefined)).toEqual({ kind: 'polling' });
  });

  it('is polling while the job is queued', () => {
    expect(
      describeBenchmarkJobPoll(runningResponse({ status: 'queued' }) as never)
    ).toEqual({ kind: 'polling' });
  });

  it('is polling while the job is running', () => {
    expect(
      describeBenchmarkJobPoll(runningResponse({ status: 'running' }) as never)
    ).toEqual({ kind: 'polling' });
  });

  it('is done once HTTP 200 reports job status done', () => {
    expect(
      describeBenchmarkJobPoll(runningResponse({ status: 'done' }) as never)
    ).toEqual({ kind: 'done' });
  });

  it('is failed once HTTP 200 reports job status error', () => {
    expect(
      describeBenchmarkJobPoll(runningResponse({ status: 'error' }) as never)
    ).toEqual({ kind: 'failed' });
  });

  it('is not_found on an HTTP 404 - unknown job id', () => {
    expect(describeBenchmarkJobPoll(httpError(404) as never)).toEqual({
      kind: 'not_found',
    });
  });

  it('is waiting with the status on HTTP 429 - the gateway rate limiter', () => {
    expect(describeBenchmarkJobPoll(httpError(429) as never)).toEqual({
      kind: 'waiting',
      httpStatus: 429,
    });
  });

  it('is waiting with the status on HTTP 401', () => {
    expect(describeBenchmarkJobPoll(httpError(401) as never)).toEqual({
      kind: 'waiting',
      httpStatus: 401,
    });
  });

  it('is waiting with the status on a 5xx gateway error', () => {
    expect(describeBenchmarkJobPoll(httpError(502) as never)).toEqual({
      kind: 'waiting',
      httpStatus: 502,
    });
  });

  it('is waiting with the status on a 504 upstream timeout', () => {
    expect(describeBenchmarkJobPoll(httpError(504) as never)).toEqual({
      kind: 'waiting',
      httpStatus: 504,
    });
  });
});

describe('nextBenchmarkJobPollDelayMs', () => {
  it('polls every 2s when there is no response yet', () => {
    expect(nextBenchmarkJobPollDelayMs(undefined)).toBe(2000);
  });

  it('polls every 2s while the job is queued or running', () => {
    expect(
      nextBenchmarkJobPollDelayMs(
        runningResponse({ status: 'queued' }) as never
      )
    ).toBe(2000);
    expect(
      nextBenchmarkJobPollDelayMs(
        runningResponse({ status: 'running' }) as never
      )
    ).toBe(2000);
  });

  it('stops polling once the job is done', () => {
    expect(
      nextBenchmarkJobPollDelayMs(runningResponse({ status: 'done' }) as never)
    ).toBe(0);
  });

  it('stops polling once the job errors', () => {
    expect(
      nextBenchmarkJobPollDelayMs(runningResponse({ status: 'error' }) as never)
    ).toBe(0);
  });

  it('stops polling on an unknown job id (404)', () => {
    expect(nextBenchmarkJobPollDelayMs(httpError(404) as never)).toBe(0);
  });

  it('backs off to 5s on HTTP 429 to respect the gateway rate limiter', () => {
    expect(nextBenchmarkJobPollDelayMs(httpError(429) as never)).toBe(5000);
  });

  it('keeps polling every 2s on HTTP 401', () => {
    expect(nextBenchmarkJobPollDelayMs(httpError(401) as never)).toBe(2000);
  });

  it('keeps polling every 2s on a 5xx gateway error', () => {
    expect(nextBenchmarkJobPollDelayMs(httpError(502) as never)).toBe(2000);
  });

  it('keeps polling every 2s on a 504 upstream timeout', () => {
    expect(nextBenchmarkJobPollDelayMs(httpError(504) as never)).toBe(2000);
  });
});

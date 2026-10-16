import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { useBenchmarkRunRows } from '@/src/app/benchmark/domain/use_benchmark_run_rows';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const wrapper = ({ children }: { children: ReactNode }) => (
  <SWRTestProvider>{children}</SWRTestProvider>
);

const ROWS_URL = `${MSW_PACT_BASE}/gateway/v1/benchmark/runs/:runId/rows`;

const captureQuery = () => {
  const captured: { query?: URLSearchParams } = {};
  server.use(
    http.get(ROWS_URL, ({ request }) => {
      captured.query = new URL(request.url).searchParams;

      return HttpResponse.json({ rows: [], total: 0 });
    })
  );

  return captured;
};

describe('useBenchmarkRunRows', () => {
  it('requests a page with the offset and omits unset filters', async () => {
    const captured = captureQuery();

    renderHook(
      () =>
        useBenchmarkRunRows('run-11', {
          offset: 100,
          category: '',
          outcome: 'all',
        }),
      { wrapper }
    );

    await waitFor(() => expect(captured.query).toBeDefined());
    expect(captured.query?.get('limit')).toBe('50');
    expect(captured.query?.get('offset')).toBe('100');
    expect(captured.query?.has('category')).toBe(false);
    expect(captured.query?.has('outcome')).toBe(false);
  });

  it('sends the category and outcome filters when set', async () => {
    const captured = captureQuery();

    renderHook(
      () =>
        useBenchmarkRunRows('run-11', {
          offset: 0,
          category: 'benign-chat',
          outcome: 'false_positive',
        }),
      { wrapper }
    );

    await waitFor(() => expect(captured.query).toBeDefined());
    expect(captured.query?.get('category')).toBe('benign-chat');
    expect(captured.query?.get('outcome')).toBe('false_positive');
  });

  it('returns the rows and the filtered total', async () => {
    const { result } = renderHook(
      () =>
        useBenchmarkRunRows('run-11', {
          offset: 0,
          category: '',
          outcome: 'unscored',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(50));
    expect(result.current.total).toBe(300);
    expect(result.current.notFound).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('reads a 404 as run not found, not as an empty run', async () => {
    const { result } = renderHook(
      () =>
        useBenchmarkRunRows('run-missing', {
          offset: 0,
          category: '',
          outcome: 'all',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.notFound).toBe(true));
    expect(result.current.rows).toEqual([]);
    expect(result.current.error).toBeUndefined();
  });

  it('surfaces other non-200 responses as an error', async () => {
    server.use(
      http.get(ROWS_URL, () =>
        HttpResponse.json(
          { code: 'unavailable', error: 'benchmark down' },
          { status: 502 }
        )
      )
    );

    const { result } = renderHook(
      () =>
        useBenchmarkRunRows('run-11', {
          offset: 0,
          category: '',
          outcome: 'all',
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.error).toBeDefined());
    expect(result.current.notFound).toBe(false);
    expect(result.current.rows).toEqual([]);
  });
});

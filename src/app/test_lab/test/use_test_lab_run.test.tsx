import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { useTestLabRun } from '@/src/app/test_lab/domain/use_test_lab_run';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// PACT-595: a failed /v1/check call is now persisted to run history instead
// of being dropped, closing the gap where a real gateway outage left no
// record of the attempt. dev:mock's seeded run-3 (createTestLabRunsMockData)
// covers the *render* of an already-failed row, but /v1/check always
// returns 200 in mock mode -- nothing else in this suite drives an actual
// check failure through runCheck's catch block, so the persist path itself
// (build payload -> POST /v1/benchmark/testlab/runs -> optimistic + revalidated
// history) has no coverage without this test.
describe('useTestLabRun - PACT-595 persisted failed runs', () => {
  it('persists a best-effort failed run when /v1/check fails, without masking the check error', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/check`, () =>
        HttpResponse.json('service unavailable', { status: 503 })
      )
    );

    const { result } = renderHook(() => useTestLabRun(), {
      wrapper: SWRTestProvider,
    });

    await waitFor(() =>
      expect(result.current.history.length).toBeGreaterThan(0)
    );
    const historyLengthBefore = result.current.history.length;

    await act(async () => {
      await result.current.runCheck('trigger a gateway outage', 'custom');
    });

    // The check failure itself must stay visible regardless of whether the
    // follow-up save succeeds -- this is the "must not mask the original
    // check error" requirement from persistRun's docblock.
    expect(result.current.status).toBe('error');

    await waitFor(() =>
      expect(result.current.history.length).toBe(historyLengthBefore + 1)
    );

    // withOptimisticRun prepends the new record, so it's the first entry
    // once the optimistic update (and later revalidation) lands.
    const persisted = result.current.history[0];
    expect(persisted.status).toBe('error');
    expect(persisted.input).toBe('trigger a gateway outage');
    if (persisted.status !== 'error') {
      throw new Error('expected status=error');
    }
    expect(persisted.error).toBe('check failed (503)');

    // The save itself (POST /v1/benchmark/testlab/runs) went through the
    // unmodified mock handler and succeeded, so no separate save-error
    // banner should appear on top of the check failure.
    expect(result.current.historySaveError).toBe(false);
  });

  it('surfaces historySaveError without clobbering the error status when the follow-up save also fails', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/check`, () =>
        HttpResponse.json('service unavailable', { status: 503 })
      ),
      http.post(`${MSW_PACT_BASE}/gateway/v1/benchmark/testlab/runs`, () =>
        HttpResponse.json('internal error', { status: 500 })
      )
    );

    const { result } = renderHook(() => useTestLabRun(), {
      wrapper: SWRTestProvider,
    });

    await waitFor(() =>
      expect(result.current.history.length).toBeGreaterThan(0)
    );

    await act(async () => {
      await result.current.runCheck('trigger a double failure', 'custom');
    });

    expect(result.current.status).toBe('error');
    await waitFor(() => expect(result.current.historySaveError).toBe(true));
  });
});

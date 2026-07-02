import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { useFilterDecisionStats } from '@/src/app/filter/domain/filter_decision_stats';

// Fresh SWR cache per render so one test's cached /v1/audit/stats entry
// never bleeds into the next (mirrors use_policy_rules.test.tsx).
const createWrapper = () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );

  return Wrapper;
};

describe('useFilterDecisionStats — PACT-363 audit:stats 403 gate (PACT-377)', () => {
  it('exposes forbidden=true and empty stats on a 403, not a raw error', async () => {
    server.use(
      http.get('*/v1/audit/stats', () =>
        HttpResponse.json(
          { error: 'insufficient permissions' },
          { status: 403 }
        )
      )
    );

    const { result } = renderHook(() => useFilterDecisionStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.forbidden).toBe(true));

    expect(result.current.error).toBe(false);
    expect(result.current.total).toBe(0);
    expect(result.current.filter.blocked).toBe(0);
    expect(result.current.filter.top_rules).toEqual([]);
  });

  it('never issues another /v1/audit/stats request once forbidden is seen', async () => {
    let requestCount = 0;
    server.use(
      http.get('*/v1/audit/stats', () => {
        requestCount++;

        return HttpResponse.json(
          { error: 'insufficient permissions' },
          { status: 403 }
        );
      })
    );

    const { result } = renderHook(() => useFilterDecisionStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.forbidden).toBe(true));
    expect(requestCount).toBe(1);

    // The 30s refreshInterval is disabled entirely once forbidden (returns
    // 0, not just "count down and check again") -- a short real wait is
    // enough to prove no re-poll was scheduled; nothing hinges on timing
    // out to 30s.
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(requestCount).toBe(1);
  });

  it('still polls normally and reports forbidden=false on 200', async () => {
    const { result } = renderHook(() => useFilterDecisionStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.forbidden).toBe(false);
    expect(result.current.error).toBe(false);
  });
});

import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { useDashboardPipelineStats } from '@/src/app/dashboard/domain/dashboard_pipeline_stats';

// Fresh SWR cache per render so one test's cached entries never bleed into
// the next (mirrors use_policy_rules.test.tsx / filter_decision_stats.test.tsx).
const createWrapper = () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );

  return Wrapper;
};

describe('useDashboardPipelineStats — PACT-363 audit:stats 403 gate (PACT-377)', () => {
  it('exposes statsForbidden=true and empty stats on a 403, without touching the live decisions query', async () => {
    server.use(
      http.get('*/v1/audit/stats', () =>
        HttpResponse.json(
          { error: 'insufficient permissions' },
          { status: 403 }
        )
      )
    );

    const { result } = renderHook(() => useDashboardPipelineStats(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.statsForbidden).toBe(true));

    // /v1/audit/events (the live stream, a separate permission) is
    // unaffected -- the console's Quick Probe / Live Decisions widgets
    // keep working for a caller who merely lacks audit:stats.
    expect(result.current.error).toBe(false);
    expect(result.current.stats.total).toBe(0);
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

    const { result } = renderHook(() => useDashboardPipelineStats(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.statsForbidden).toBe(true));
    expect(requestCount).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(requestCount).toBe(1);
  });

  it('reports statsForbidden=false on 200', async () => {
    const { result } = renderHook(() => useDashboardPipelineStats(false), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.statsForbidden).toBe(false);
    expect(result.current.error).toBe(false);
  });
});

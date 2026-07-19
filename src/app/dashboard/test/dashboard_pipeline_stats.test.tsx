import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BENIGN_LABELS } from '@/src/__codegen__/schema/pact-decisions';
import {
  BENIGN_CLASSIFIER_LABELS,
  decisionSeverity,
  useDashboardPipelineStats,
} from '@/src/app/dashboard/domain/dashboard_pipeline_stats';

describe('useDashboardPipelineStats - PACT-363 audit:stats 403 gate (PACT-377)', () => {
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
      wrapper: SWRTestProvider,
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
      wrapper: SWRTestProvider,
    });

    await waitFor(() => expect(result.current.statsForbidden).toBe(true));
    expect(requestCount).toBe(1);

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(requestCount).toBe(1);
  });

  it('reports statsForbidden=false on 200', async () => {
    const { result } = renderHook(() => useDashboardPipelineStats(false), {
      wrapper: SWRTestProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.statsForbidden).toBe(false);
    expect(result.current.error).toBe(false);
  });
});

describe('BENIGN_CLASSIFIER_LABELS (PACT-574)', () => {
  it('matches the vendored pact-contracts benign-label contract exactly', () => {
    // Drift guard: BENIGN_CLASSIFIER_LABELS must derive 1:1 from BENIGN_LABELS
    // (src/__codegen__/schema/pact-decisions, vendored from pact-contracts'
    // decisions/benign_labels.json). If pact-contracts adds or removes a
    // label, `pnpm api:update` + `pnpm schema:codegen` regenerates
    // BENIGN_LABELS and this assertion catches the drift immediately.
    expect(BENIGN_CLASSIFIER_LABELS).toEqual(
      new Set(BENIGN_LABELS.map((label) => label.toLowerCase()))
    );
  });

  it('normalizes the derived set to lowercase, ready for case-insensitive lookup', () => {
    // BENIGN_CLASSIFIER_LABELS itself only ever holds lowercase entries -
    // isBenignLabel does the actual case folding by lowercasing the
    // *incoming* label before the `.has()` lookup (see the "any case" test
    // below, which exercises that path end-to-end via decisionSeverity).
    for (const label of BENIGN_LABELS) {
      expect(BENIGN_CLASSIFIER_LABELS.has(label.toLowerCase())).toBe(true);
    }
  });

  it('does not vendor the empty-label rule as a set entry', () => {
    // The contract's $comment documents "absent/empty counts as benign" as a
    // consumer-side presence rule, deliberately not an entry in
    // decisions/benign_labels.json's `labels` array. Confirmed here so the
    // vendored contract's shape stays honest, and exercised end-to-end via
    // decisionSeverity below.
    expect(BENIGN_CLASSIFIER_LABELS.has('')).toBe(false);
  });

  it('treats an absent classifier.label as clean, not flagged', () => {
    expect(decisionSeverity({ decision: 'allow' })).toBe('clean');
  });

  it('treats a benign classifier.label (any case) as clean, not flagged', () => {
    expect(
      decisionSeverity({ decision: 'allow', classifier: { label: 'BENIGN' } })
    ).toBe('clean');
  });

  it('treats a non-benign classifier.label as flagged', () => {
    expect(
      decisionSeverity({
        decision: 'allow',
        classifier: { label: 'injection' },
      })
    ).toBe('flagged');
  });
});

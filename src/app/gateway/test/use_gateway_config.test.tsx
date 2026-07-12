import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { SWRConfig } from 'swr';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { useGatewayConfig } from '@/src/app/gateway/domain/use_gateway_config';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// Fresh SWR cache per render so one test's cached entry never bleeds into
// the next (mirrors use_policy_rules.test.tsx / dashboard_pipeline_stats.test.tsx).
const createWrapper = () => {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {children}
    </SWRConfig>
  );

  return Wrapper;
};

// The mock-mode default (src/app/gateway/mock/data/gateway.ts's
// mockGatewayConfig seed) sets sandboxEnabled/diagnosticsEnabled to true so
// the Playwright suite can demonstrate a live hostile-external_ref verdict and a
// causal-span BLOCK example without any setup step. Real dev deployments
// default SANDBOX_ENABLED to false (pact-gateway internal/app/config.go), and
// GatewaySandboxPanel/GatewayDiagnosticsPanel each render an explicit
// disabled-state message when config says so instead of an empty table --
// this is the "sandbox-disabled variant" the issue asks be demonstrable in
// mock mode. Playwright has no per-test MSW handler override in this repo
// (see the docblock in mock/data/gateway.ts), so this hook-level test
// exercises the data layer both panels branch on, using the same
// server.use() override pattern already established by
// use_policy_rules.test.tsx / dashboard_pipeline_stats.test.tsx.
describe('useGatewayConfig', () => {
  it('reflects the mock-mode default: sandbox and diagnostics enabled', async () => {
    const { result } = renderHook(() => useGatewayConfig(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.config?.sandboxEnabled).toBe(true);
    expect(result.current.config?.diagnosticsEnabled).toBe(true);
  });

  it('surfaces sandboxEnabled=false / diagnosticsEnabled=false when the gateway build reports them disabled', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/config`, () =>
        HttpResponse.json({
          classifierEnforceMode: 'enforce',
          vectorEnforceMode: 'enforce',
          consensusThreshold: 0.55,
          sandboxEnabled: false,
          sandboxIsolation: 'none',
          sandboxRuntimeWrapped: false,
          diagnosticsEnabled: false,
          spotlightFormat: 'delim',
          requestTimeoutSeconds: 30,
        })
      )
    );

    const { result } = renderHook(() => useGatewayConfig(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.config?.sandboxEnabled).toBe(false);
    expect(result.current.config?.diagnosticsEnabled).toBe(false);
  });

  it('surfaces a request failure as an error rather than an empty config', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/config`, () =>
        HttpResponse.json('unauthorized', { status: 401 })
      )
    );

    const { result } = renderHook(() => useGatewayConfig(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    expect(result.current.config).toBeUndefined();
  });
});

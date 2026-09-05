import { render, screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { GatewayEnforcementPanel } from '@/src/app/gateway/ui/GatewayEnforcementPanel';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const renderPanel = () =>
  render(
    (
      <SWRTestProvider>
        <GatewayEnforcementPanel />
      </SWRTestProvider>
    ) as ReactNode
  );

// PACT-936: the config grid's "Compliance shadow" tile reflects
// complianceShadowEnabled the same way the pre-existing "Sandbox" and
// "Diagnostics" tiles reflect their booleans -- Enabled when the gateway
// build reports the deferred compliance-check stage is on, Disabled
// otherwise (including when the field is absent, i.e. a gateway build that
// predates PACT-814).
describe('GatewayEnforcementPanel compliance shadow tile', () => {
  it('shows Enabled when the gateway reports complianceShadowEnabled: true', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/config`, () =>
        HttpResponse.json({
          consensusThreshold: 0.55,
          sandboxEnabled: true,
          sandboxIsolation: 'namespace',
          diagnosticsEnabled: true,
          complianceShadowEnabled: true,
          spotlightFormat: 'xml',
          requestTimeoutSeconds: 30,
        })
      )
    );

    renderPanel();

    const label = await screen.findByText('Compliance shadow');
    expect(label.closest('div')?.textContent).toBe('Compliance shadowEnabled');
  });

  it('shows Disabled when the gateway omits complianceShadowEnabled', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/config`, () =>
        HttpResponse.json({
          consensusThreshold: 0.55,
          sandboxEnabled: false,
          sandboxIsolation: 'none',
          diagnosticsEnabled: false,
          spotlightFormat: 'delim',
          requestTimeoutSeconds: 30,
        })
      )
    );

    renderPanel();

    const label = await screen.findByText('Compliance shadow');
    expect(label.closest('div')?.textContent).toBe('Compliance shadowDisabled');
  });
});

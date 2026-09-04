import { render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { GatewaySpotlightPanel } from '@/src/app/gateway/ui/GatewaySpotlightPanel';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const renderPanel = () =>
  render(
    (
      <SWRTestProvider>
        <GatewaySpotlightPanel />
      </SWRTestProvider>
    ) as ReactNode
  );

// PACT-917: spotlightFormatLabel(undefined) returns "Unknown", so before
// this fix the panel flashed "Current format: Unknown" on every mount while
// GET /v1/config was still in flight -- indistinguishable from a resolved
// response that genuinely has no spotlightFormat. The loading state must
// show its own copy, and "Unknown" must be reserved for a settled response.
describe('GatewaySpotlightPanel current-format copy', () => {
  it('shows a loading placeholder, not Unknown, while the config fetch is in flight', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/config`, async () => {
        await delay('infinite');

        return HttpResponse.json({});
      })
    );

    renderPanel();

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Unknown')).not.toBeInTheDocument();
  });

  it('shows the resolved format label once the config request settles', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/config`, () =>
        HttpResponse.json({ spotlightFormat: 'xml' })
      )
    );

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText('XML tags')).toBeInTheDocument()
    );
  });

  it('shows Unknown once the request settles with no spotlightFormat value', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/config`, () =>
        HttpResponse.json({})
      )
    );

    renderPanel();

    await waitFor(() =>
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    );
  });
});

import { render, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { AuditWorkbench } from '@/src/app/audit/ui/AuditWorkbench';

const renderWorkbench = () =>
  render(
    (
      <SWRTestProvider>
        <AuditWorkbench />
      </SWRTestProvider>
    ) as ReactNode
  );

// PACT-917: PaginationFooter's emptyText and the inline "Loading activity..."
// message both key off an empty events list, which is true both mid-fetch
// (before the first page has arrived) and once a genuinely empty result has
// settled. Before this fix, AuditWorkbench passed emptyText unconditionally,
// so "Loading activity..." and "No matching rows" rendered together on
// every initial load. These two states must stay mutually exclusive.
describe('AuditWorkbench loading vs. empty state', () => {
  it('shows the loading message and withholds the empty-footer text while the fetch is in flight', async () => {
    server.use(
      http.get('*/api/pact/gateway/v1/audit/events', async () => {
        await delay('infinite');

        return HttpResponse.json({ events: [], total: 0 });
      })
    );

    renderWorkbench();

    expect(screen.getByText('Loading activity…')).toBeInTheDocument();
    expect(screen.queryByText('No matching rows')).not.toBeInTheDocument();
  });

  it('shows the empty-footer text once a genuinely empty result has loaded', async () => {
    server.use(
      http.get('*/api/pact/gateway/v1/audit/events', () =>
        HttpResponse.json({ events: [], total: 0 })
      )
    );

    renderWorkbench();

    await waitFor(() =>
      expect(screen.getByText('No matching rows')).toBeInTheDocument()
    );
    expect(screen.queryByText('Loading activity…')).not.toBeInTheDocument();
  });
});

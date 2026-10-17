import { render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { AuditComplianceControlStatsTable } from '@/src/app/audit/ui/AuditComplianceControlStatsTable';
import { AuditComplianceView } from '@/src/app/audit/ui/AuditComplianceView';

const stat = (controlId: string, total: number, block: number) => ({
  framework: 'owasp_llm_top10',
  controlId,
  total,
  block,
  allow: total - block,
});

const renderView = () =>
  render(
    <SWRTestProvider>
      <AuditComplianceView />
    </SWRTestProvider>
  );

describe('AuditComplianceControlStatsTable', () => {
  it('sorts rows by total descending', () => {
    render(
      <AuditComplianceControlStatsTable
        stats={[stat('LLM02', 3, 1), stat('LLM01', 9, 4), stat('LLM06', 5, 0)]}
      />
    );

    const rows = screen.getAllByTestId('audit-compliance-stat-row');
    const totals = rows.map(
      (row) => within(row).getAllByRole('cell')[2]?.textContent
    );

    expect(totals).toEqual(['9', '5', '3']);
    expect(rows[0]).toHaveTextContent('OWASP LLM01');
    expect(rows[0]).toHaveTextContent('OWASP LLM Top 10');
  });

  it('shows the unmapped row only when it has decisions', () => {
    const { rerender } = render(
      <AuditComplianceControlStatsTable
        stats={[stat('LLM01', 2, 1)]}
        unmapped={{ total: 4, allow: 3, block: 1 }}
      />
    );

    expect(
      screen.getByTestId('audit-compliance-unmapped-row')
    ).toHaveTextContent('Unmapped');

    rerender(
      <AuditComplianceControlStatsTable
        stats={[stat('LLM01', 2, 1)]}
        unmapped={{ total: 0, allow: 0, block: 0 }}
      />
    );

    expect(
      screen.queryByTestId('audit-compliance-unmapped-row')
    ).not.toBeInTheDocument();
  });

  it('shows the empty state when nothing was decided', () => {
    render(
      <AuditComplianceControlStatsTable
        stats={[]}
        unmapped={{ total: 0, allow: 0, block: 0 }}
      />
    );

    expect(screen.getByTestId('audit-compliance-empty')).toHaveTextContent(
      'No decisions in this window'
    );
    expect(
      screen.queryByTestId('audit-compliance-stats-table')
    ).not.toBeInTheDocument();
  });
});

describe('AuditComplianceView', () => {
  it('renders the fetched control totals', async () => {
    server.use(
      http.get('*/v1/audit/control-stats', () =>
        HttpResponse.json({
          stats: [stat('LLM01', 7, 2)],
          unmapped: { total: 1, allow: 1, block: 0 },
        })
      )
    );

    renderView();

    await waitFor(() =>
      expect(screen.getAllByTestId('audit-compliance-stat-row')).toHaveLength(1)
    );
    expect(
      screen.getByTestId('audit-compliance-unmapped-row')
    ).toBeInTheDocument();
    expect(screen.getByTestId('audit-compliance-download')).toBeEnabled();
  });

  it('renders the permission-aware empty state on a 403', async () => {
    server.use(
      http.get('*/v1/audit/control-stats', () =>
        HttpResponse.json(
          { error: 'insufficient permissions' },
          { status: 403 }
        )
      )
    );

    renderView();

    expect(
      await screen.findByTestId('audit-compliance-forbidden')
    ).toHaveTextContent(
      'Compliance aggregates need the audit:stats permission'
    );
    expect(
      screen.queryByTestId('audit-compliance-download')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Failed to load compliance totals/)
    ).not.toBeInTheDocument();
  });

  it('renders the error row on a server failure', async () => {
    server.use(
      http.get('*/v1/audit/control-stats', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 })
      )
    );

    renderView();

    expect(
      await screen.findByText(/Failed to load compliance totals/)
    ).toBeInTheDocument();
  });
});

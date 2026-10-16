import { render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BenchmarkResultsTable } from '@/src/app/benchmark/ui/BenchmarkResultsTable';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const serveRows = (rows: unknown[]) =>
  server.use(
    http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/jobs/:jobId`, () =>
      HttpResponse.json({
        status: 'done',
        progress_pct: 100,
        result: {
          detection_rate: 0.5,
          fp_rate: 0,
          p50_latency_ms: 10,
          p99_latency_ms: 20,
          total_rows: rows.length,
          rows,
        },
      })
    )
  );

const renderTable = (totalRows: number) =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkResultsTable jobId="job-1" totalRows={totalRows} />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('BenchmarkResultsTable unscored rows', () => {
  it('marks an unscored row as unscored instead of showing its fail-open decision as a verdict', async () => {
    serveRows([
      {
        row_id: 'row-scored',
        expected_label: 'block',
        decision: 'block',
        latency_ms: 12,
      },
      {
        row_id: 'row-unscored',
        expected_label: 'block',
        decision: 'allow',
        latency_ms: 9,
        unscored: true,
      },
    ]);
    renderTable(2);

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(3));
    const [, scored, unscored] = screen.getAllByRole('row');

    // The scored row still shows its verdict and a correctness mark.
    // Expected label and decision are both "block".
    expect(within(scored).getAllByText('block')).toHaveLength(2);
    expect(within(scored).getByLabelText('Correct')).toBeInTheDocument();

    // The unscored row shows the marker only: no "allow" verdict, and no
    // correct/incorrect judgement of a decision that was never a verdict.
    expect(within(unscored).getByText('unscored')).toBeVisible();
    expect(within(unscored).queryByText('allow')).not.toBeInTheDocument();
    expect(
      within(unscored).queryByLabelText('Correct')
    ).not.toBeInTheDocument();
    expect(
      within(unscored).queryByLabelText('Incorrect')
    ).not.toBeInTheDocument();
  });

  it('shows an unflagged fail-open looking row as an ordinary verdict', async () => {
    serveRows([
      {
        row_id: 'row-allow',
        expected_label: 'block',
        decision: 'allow',
        latency_ms: 9,
        unscored: false,
      },
    ]);
    renderTable(1);

    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(2));
    const [, row] = screen.getAllByRole('row');

    expect(within(row).getByText('allow')).toBeVisible();
    expect(within(row).queryByText('unscored')).not.toBeInTheDocument();
    expect(within(row).getByLabelText('Incorrect')).toBeInTheDocument();
  });
});

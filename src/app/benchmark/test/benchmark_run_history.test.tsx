import { render, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { type BenchmarkRun } from '@/src/app/benchmark/domain/benchmark_run';
import { BenchmarkRunHistory } from '@/src/app/benchmark/ui/BenchmarkRunHistory';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const makeRun = (index: number): BenchmarkRun => ({
  id: `history-${index}`,
  gateway_version: 'v0.0.0',
  engine: index % 2 === 0 ? 'stub' : 'deberta',
  corpus_version: 'seed-v1.jsonl',
  detection_rate: 0.9,
  fp_rate: 0.05,
  p50_latency: 10,
  p99_latency: 50,
  row_count: 100 + index,
  ran_at: 1_700_000_000 + index * 3600,
});

const serveRuns = (runs: BenchmarkRun[]) =>
  server.use(
    http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/runs`, () =>
      HttpResponse.json({ runs, total: runs.length })
    )
  );

const renderHistory = () =>
  render(
    <SWRTestProvider>
      <BenchmarkRunHistory dateRange="all" />
    </SWRTestProvider>
  );

describe('BenchmarkRunHistory', () => {
  it('lists runs newest first with a link to each run rows page', async () => {
    serveRuns([makeRun(1), makeRun(2), makeRun(3)]);
    renderHistory();

    const rows = await screen.findAllByTestId('benchmark-run-history-row');
    expect(rows).toHaveLength(3);
    // Newest (history-3) first; the row count tells the runs apart.
    expect(within(rows[0]).getByText('103')).toBeVisible();
    expect(within(rows[2]).getByText('101')).toBeVisible();
    expect(
      within(rows[0]).getByRole('link', { name: /^Rows of the deberta run/ })
    ).toHaveAttribute('href', '/benchmark/runs/history-3');
    expect(screen.queryByText(/Showing 20 of/)).not.toBeInTheDocument();
  });

  it('names every run rows link by its run so none collides with the job View rows link', async () => {
    serveRuns([makeRun(1), makeRun(2), makeRun(3)]);
    renderHistory();

    const links = await screen.findAllByRole('link', { name: /^Rows of the/ });
    const names = links.map((link) => link.getAttribute('aria-label'));
    expect(new Set(names).size).toBe(3);
    expect(
      screen.queryByRole('link', { name: 'View rows' })
    ).not.toBeInTheDocument();
  });

  it('caps the list at 20 runs and says how many exist', async () => {
    serveRuns(Array.from({ length: 25 }, (_, i) => makeRun(i + 1)));
    renderHistory();

    await waitFor(() =>
      expect(screen.getAllByTestId('benchmark-run-history-row')).toHaveLength(
        20
      )
    );
    expect(screen.getByText('Showing 20 of 25 runs')).toBeVisible();
  });

  it('shows an empty state when there are no runs', async () => {
    serveRuns([]);
    renderHistory();

    expect(
      await screen.findByText('No benchmark runs in this range.')
    ).toBeVisible();
  });

  it('shows a failure state when the runs request fails', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/runs`, () =>
        HttpResponse.json({ error: 'down' }, { status: 502 })
      )
    );
    renderHistory();

    expect(
      await screen.findByText('Failed to load benchmark runs.')
    ).toBeVisible();
  });
});

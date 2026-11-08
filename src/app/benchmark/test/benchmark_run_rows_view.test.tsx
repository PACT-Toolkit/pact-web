import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BenchmarkRunRowsView } from '@/src/app/benchmark/ui/BenchmarkRunRowsView';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const renderView = (runId: string) =>
  render(
    <SWRTestProvider>
      <BenchmarkRunRowsView runId={runId} />
    </SWRTestProvider>
  );

// Each test renders 50-row tables from the mock handlers and several tests
// page or filter, which re-renders them. That takes one to three seconds on an
// idle machine, so the 5 s default fails on a CPU-starved one. The timeout
// is scoped to this view; the global default stays at 5 s.
describe('BenchmarkRunRowsView', { timeout: 20_000 }, () => {
  it('renders the first page with the run metadata and a range caption', async () => {
    renderView('run-11');

    await waitFor(() =>
      expect(screen.getAllByTestId('benchmark-run-rows-row')).toHaveLength(50)
    );
    expect(screen.getByText('1-50 of 2000')).toBeVisible();
    expect(
      screen.getByText(/2000 rows · 300 unscored · 40 mitigated/)
    ).toBeVisible();
  });

  it('shows unavailable metadata for a run missing from the run list', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/runs`, () =>
        HttpResponse.json({ runs: [], total: 0 })
      )
    );
    renderView('run-11');

    expect(await screen.findByText('Run metadata unavailable')).toBeVisible();
    await waitFor(() =>
      expect(screen.getAllByTestId('benchmark-run-rows-row')).toHaveLength(50)
    );
  });

  it('marks unscored, throttled, and errored rows instead of showing a verdict', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/runs/:runId/rows`, () =>
        HttpResponse.json({
          total: 3,
          rows: [
            {
              seq: 1,
              row_id: 'r1',
              expected_label: 'block',
              decision: 'allow',
              latency_ms: 1,
              unscored: true,
            },
            {
              seq: 2,
              row_id: 'r2',
              expected_label: 'block',
              decision: 'allow',
              latency_ms: 2,
              throttled: true,
            },
            {
              seq: 3,
              row_id: 'r3',
              expected_label: 'allow',
              decision: '',
              latency_ms: 3,
              error: 'upstream timeout',
            },
          ],
        })
      )
    );
    renderView('run-11');

    await waitFor(() =>
      expect(screen.getAllByTestId('benchmark-run-rows-row')).toHaveLength(3)
    );
    expect(screen.getByText('unscored')).toBeVisible();
    expect(screen.getByText('throttled')).toBeVisible();
    expect(screen.getByText('error')).toBeVisible();
    // The fail-open allow of the unscored and throttled rows is not shown as
    // a verdict; the only "allow" chip left is the errored row's expected label.
    expect(screen.getAllByText('allow')).toHaveLength(1);
  });

  it('badges a mitigated row and requests only mitigated rows when that filter is chosen', async () => {
    const outcomes: (string | null)[] = [];
    server.use(
      http.get(
        `${MSW_PACT_BASE}/gateway/v1/benchmark/runs/:runId/rows`,
        ({ request }) => {
          outcomes.push(new URL(request.url).searchParams.get('outcome'));

          return HttpResponse.json({
            total: 1,
            rows: [
              {
                seq: 1,
                row_id: 'r1',
                expected_label: 'block',
                decision: 'allow',
                latency_ms: 1,
                redacted: true,
                reason: 'classifier_mitigated',
              },
            ],
          });
        }
      )
    );
    renderView('run-11');

    expect(
      await screen.findByTestId('benchmark-row-mitigated-badge')
    ).toBeVisible();

    fireEvent.keyDown(screen.getByTestId('benchmark-run-rows-outcome'), {
      key: 'ArrowDown',
    });
    fireEvent.click(await screen.findByRole('option', { name: 'Mitigated' }));

    await waitFor(() => expect(outcomes).toContain('mitigated'));
  });

  it('pages forward and back with the caption following', async () => {
    renderView('run-11');
    await screen.findByText('1-50 of 2000');

    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(await screen.findByText('51-100 of 2000')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(await screen.findByText('1-50 of 2000')).toBeVisible();
  });

  it('goes back to the first page when a filter changes', async () => {
    renderView('run-11');
    await screen.findByText('1-50 of 2000');
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('51-100 of 2000');

    fireEvent.change(screen.getByTestId('benchmark-run-rows-category'), {
      target: { value: 'benign-chat' },
    });

    expect(await screen.findByText(/^1-50 of \d+$/)).toBeVisible();
    expect(screen.queryByText('51-100 of 2000')).not.toBeInTheDocument();
  });

  it('shows an empty-page message when the filter matches nothing', async () => {
    renderView('run-11');
    await screen.findByText('1-50 of 2000');

    fireEvent.change(screen.getByTestId('benchmark-run-rows-category'), {
      target: { value: 'no-such-category' },
    });

    expect(await screen.findByText('No rows match.')).toBeVisible();
  });

  it('offers the run categories as suggestions for the category filter', async () => {
    const { container } = renderView('run-11');

    await waitFor(() =>
      expect(container.querySelectorAll('datalist option')).toHaveLength(3)
    );
  });

  it('says the run was not found on a 404', async () => {
    renderView('run-missing');

    expect(await screen.findByText('Run not found.')).toBeVisible();
    expect(
      screen.queryByTestId('benchmark-run-rows-row')
    ).not.toBeInTheDocument();
  });

  it('shows an error line when the rows request fails', async () => {
    server.use(
      http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/runs/:runId/rows`, () =>
        HttpResponse.json({ error: 'down' }, { status: 502 })
      )
    );
    renderView('run-11');

    expect(await screen.findByText('Failed to load rows.')).toBeVisible();
  });
});

describe('BenchmarkRunRowsView degraded run', { timeout: 20_000 }, () => {
  it('keeps the counts on their own wrapping line with the degraded badge', async () => {
    renderView('run-12');

    const counts = await screen.findByTestId('benchmark-run-rows-counts');
    expect(counts).toHaveTextContent('120 rows · 4 unscored · 2 mitigated');
    expect(counts).toHaveClass('flex-wrap');
    expect(counts).toContainElement(
      screen.getByTestId('benchmark-degraded-badge')
    );
    expect(screen.getByTestId('benchmark-run-rows-identity')).not.toHaveClass(
      'truncate'
    );
  });

  it('shows the attempts marker on retried rows only', async () => {
    renderView('run-12');

    await waitFor(() =>
      expect(screen.getAllByTestId('benchmark-run-rows-row')).toHaveLength(50)
    );
    const markers = screen.getAllByTestId('benchmark-row-attempts');
    for (const marker of markers) {
      expect(marker.textContent).toMatch(/^×[2-9]$/);
    }
  });

  it('shows no degraded badge on a run that was not degraded', async () => {
    renderView('run-11');

    await screen.findByTestId('benchmark-run-rows-counts');
    expect(
      screen.queryByTestId('benchmark-degraded-badge')
    ).not.toBeInTheDocument();
  });
});

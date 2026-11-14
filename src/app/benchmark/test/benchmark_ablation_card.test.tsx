import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import {
  MOCK_ABLATION_RESULT,
  MOCK_ABLATION_RUN_ID,
} from '@/src/app/benchmark/mock/data/benchmark_ablation';
import { BenchmarkAblationCard } from '@/src/app/benchmark/ui/BenchmarkAblationCard';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const renderCard = (runId: string) =>
  render(
    <SWRTestProvider>
      <BenchmarkAblationCard runId={runId} />
    </SWRTestProvider>
  );

let answered = false;

const answer = (status: number, body: unknown) => {
  answered = false;
  server.use(
    http.get(
      `${MSW_PACT_BASE}/gateway/v1/benchmark/runs/:runId/ablation`,
      () => {
        answered = true;

        return HttpResponse.json(body as never, { status });
      }
    )
  );
};

// Waits for the stubbed answer to be served, then lets the hook consume it.
const settled = async () => {
  await waitFor(() => expect(answered).toBe(true));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
};

describe('BenchmarkAblationCard', () => {
  it('lists the seven configurations in server order with readable labels', async () => {
    renderCard(MOCK_ABLATION_RUN_ID);

    const rows = await screen.findAllByTestId('benchmark-ablation-row');

    expect(rows).toHaveLength(7);
    expect(rows.map((r) => r.querySelector('th')?.textContent)).toEqual([
      'No defense',
      'Rules',
      'Rules + similarity',
      'Classifier',
      'Rules + classifier',
      'Rules + similarity + classifier',
      'Full chain',
    ]);
    expect(screen.getByText('Ablation')).toBeVisible();
  });

  it('shows rates with intervals and the known rows they are taken over', async () => {
    renderCard(MOCK_ABLATION_RUN_ID);

    const fullChain = (
      await screen.findAllByTestId('benchmark-ablation-row')
    )[6];

    expect(fullChain).toHaveTextContent('95.0%');
    expect(fullChain).toHaveTextContent('57 of 60 attacks');
    expect(fullChain).toHaveTextContent('3.3%');
    expect(fullChain).toHaveTextContent('2 of 60 benign rows');
    expect(fullChain).toHaveTextContent('95% CI');
    expect(fullChain).toHaveTextContent('151 ms / 433 ms');
  });

  it('renders the server notes under the table', async () => {
    renderCard(MOCK_ABLATION_RUN_ID);

    const notes = await screen.findByTestId('benchmark-ablation-notes');

    for (const note of MOCK_ABLATION_RESULT.notes) {
      expect(notes).toHaveTextContent(note);
    }
  });

  it('opens the latency explanation when its header is focused', async () => {
    renderCard(MOCK_ABLATION_RUN_ID);

    const hint = await screen.findByTestId('benchmark-ablation-latency-hint');
    expect(hint).toHaveTextContent('estimated');
    fireEvent.focus(hint);

    expect(
      await screen.findByRole('tooltip', {
        name: /not measured on a gateway running this configuration/,
      })
    ).toBeInTheDocument();
  });

  it('opens the per-reason breakdown when the unknown count is focused', async () => {
    renderCard(MOCK_ABLATION_RUN_ID);

    const hints = await screen.findAllByTestId(
      'benchmark-ablation-unknown-hint'
    );
    // The classifier-only row: 3 unknown attacks + 2 unknown benign rows.
    expect(hints[0]).toHaveTextContent('5');
    fireEvent.focus(hints[0]);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('timeout: 3 layers');
    expect(tooltip).toHaveTextContent('throttled: 3 layers');
  });

  it('renders no hint button for a configuration with no unknown rows', async () => {
    renderCard(MOCK_ABLATION_RUN_ID);

    const rows = await screen.findAllByTestId('benchmark-ablation-row');

    expect(rows[0].querySelector('button')).toBeNull();
  });

  it('renders nothing for a run that was not started with ablation (409)', async () => {
    answer(409, { code: 'run_not_ablation', error: 'not an ablation run' });
    const { container } = renderCard('run-8');

    await settled();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing for an unknown run (404)', async () => {
    answer(404, { code: 'not_found' });
    const { container } = renderCard('run-missing');

    await settled();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a compact unavailable line for a failing service', async () => {
    answer(503, { code: 'unavailable', error: 'benchmark unavailable' });
    renderCard(MOCK_ABLATION_RUN_ID);

    expect(
      await screen.findByTestId('benchmark-ablation-unavailable')
    ).toHaveTextContent('Ablation result unavailable');
    expect(screen.queryByTestId('benchmark-ablation-row')).toBeNull();
  });

  it('renders nothing while the answer is pending', () => {
    const { container } = renderCard(MOCK_ABLATION_RUN_ID);

    expect(container).toBeEmptyDOMElement();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { type BenchmarkAdaptiveCampaignBody } from '@/src/__codegen__/rest/benchmark';
import { mockAdaptiveCampaign } from '@/src/app/benchmark/mock/data/benchmark_adaptive';
import { BenchmarkAdaptiveStartForm } from '@/src/app/benchmark/ui/BenchmarkAdaptiveStartForm';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const START_URL = `${MSW_PACT_BASE}/gateway/v1/benchmark/adaptive-attack/campaigns`;

const renderForm = (
  newest?: BenchmarkAdaptiveCampaignBody,
  handlers: { onStarted?: () => void; onConflict?: () => void } = {}
) =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkAdaptiveStartForm
          newest={newest}
          onStarted={handlers.onStarted ?? vi.fn()}
          onConflict={handlers.onConflict ?? vi.fn()}
        />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('BenchmarkAdaptiveStartForm', () => {
  it('starts the demo preset on the default corpus and reports the new id', async () => {
    let sent: unknown;
    server.use(
      http.post(START_URL, async ({ request }) => {
        sent = await request.json();

        return HttpResponse.json({ campaign_id: 'new-id' }, { status: 202 });
      })
    );
    const onStarted = vi.fn();
    renderForm(undefined, { onStarted });

    fireEvent.click(screen.getByTestId('benchmark-adaptive-start'));

    await waitFor(() => expect(onStarted).toHaveBeenCalledWith('new-id'));
    expect(sent).toEqual({
      corpus_name: 'pact-801-attack-sample-v1.jsonl',
      goal_limit: 3,
    });
  });

  it('locks Start and says why while the newest campaign runs', () => {
    renderForm(
      mockAdaptiveCampaign({
        id: '3f9c1a52-6d1e-4c1a-9a53-0f4e7b2d8a10',
        status: 'running',
        goals_done: 1,
        goals_total: 3,
      })
    );

    expect(screen.getByTestId('benchmark-adaptive-start')).toBeDisabled();
    expect(
      screen.getByTestId('benchmark-adaptive-running-gate')
    ).toHaveTextContent('Campaign 3f9c1a52 is running: 1 of 3 goals.');
  });

  it('keeps Start enabled and shows no gate once the newest campaign is terminal', () => {
    renderForm(mockAdaptiveCampaign({ id: 'abc', status: 'done' }));

    expect(screen.getByTestId('benchmark-adaptive-start')).toBeEnabled();
    expect(
      screen.queryByTestId('benchmark-adaptive-running-gate')
    ).not.toBeInTheDocument();
  });

  it('shows the fixed message for a 409 and asks for a list revalidation', async () => {
    server.use(
      http.post(START_URL, () =>
        HttpResponse.json(
          { code: 'already_exists', error: 'a campaign is already running' },
          { status: 409 }
        )
      )
    );
    const onConflict = vi.fn();
    renderForm(undefined, { onConflict });

    fireEvent.click(screen.getByTestId('benchmark-adaptive-start'));

    expect(
      await screen.findByTestId('benchmark-submit-error')
    ).toHaveTextContent(
      'A campaign is already running. Wait for it to finish.'
    );
    expect(onConflict).toHaveBeenCalledTimes(1);
  });

  it('shows the server message for a 400', async () => {
    server.use(
      http.post(START_URL, () =>
        HttpResponse.json(
          {
            code: 'failed_precondition',
            error: 'no attacker configured in this deployment',
          },
          { status: 400 }
        )
      )
    );
    renderForm();

    fireEvent.click(screen.getByTestId('benchmark-adaptive-start'));

    expect(
      await screen.findByTestId('benchmark-submit-error')
    ).toHaveTextContent('no attacker configured in this deployment');
  });
});

import { fireEvent, render, screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { mockAdaptiveCampaign } from '@/src/app/benchmark/mock/data/benchmark_adaptive';
import { BenchmarkAdaptiveAttackCard } from '@/src/app/benchmark/ui/BenchmarkAdaptiveAttackCard';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const CAMPAIGNS_URL = `${MSW_PACT_BASE}/gateway/v1/benchmark/adaptive-attack/campaigns`;

const renderCard = () =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkAdaptiveAttackCard />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('BenchmarkAdaptiveAttackCard', { timeout: 20_000 }, () => {
  it('shows the newest finished campaign with its result and goal rows', async () => {
    renderCard();

    const result = await screen.findByTestId('benchmark-adaptive-result');
    expect(within(result).getByText('ASR (all)')).toBeInTheDocument();
    expect(within(result).getByText('ASR (attackable)')).toBeInTheDocument();
    expect(within(result).getByText('Goals succeeded')).toBeInTheDocument();
    for (const label of [
      'Seed allowed',
      'Succeeded after rewrite',
      'Budget exhausted, blocked',
      'Attacker refused',
      'Attacker stalled',
      'Input rejected',
      'Provider error',
      'Gateway error',
    ]) {
      expect(within(result).getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId('benchmark-adaptive-goal-row')).toHaveLength(
      12
    );
    expect(screen.getByTestId('benchmark-adaptive-status')).toHaveAttribute(
      'data-status',
      'done'
    );
  });

  it('locks Start behind a running newest campaign and shows its progress', async () => {
    const running = mockAdaptiveCampaign({
      id: 'aaaaaaaa-1111-2222-3333-444444444444',
      status: 'running',
      goals_total: 3,
      goals_done: 1,
      started_at: 1_700_000_000,
    });
    server.use(
      http.get(CAMPAIGNS_URL, () =>
        HttpResponse.json({ campaigns: [running] })
      ),
      http.get(`${CAMPAIGNS_URL}/${running.id}`, () =>
        HttpResponse.json(running)
      )
    );
    renderCard();

    expect(
      await screen.findByTestId('benchmark-adaptive-running-gate')
    ).toHaveTextContent('Campaign aaaaaaaa is running: 1 of 3 goals.');
    expect(screen.getByTestId('benchmark-adaptive-start')).toBeDisabled();
    expect(await screen.findByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '33'
    );
  });

  it('marks an interrupted campaign and shows its error text', async () => {
    const interrupted = mockAdaptiveCampaign({
      id: 'bbbbbbbb-1111-2222-3333-444444444444',
      status: 'interrupted',
      goals_total: 3,
      goals_done: 1,
      error: 'stopped by a restart',
    });
    server.use(
      http.get(CAMPAIGNS_URL, () =>
        HttpResponse.json({ campaigns: [interrupted] })
      ),
      http.get(`${CAMPAIGNS_URL}/${interrupted.id}`, () =>
        HttpResponse.json(interrupted)
      )
    );
    renderCard();

    expect(
      await screen.findByTestId('benchmark-adaptive-status')
    ).toHaveAttribute('data-status', 'interrupted');
    expect(screen.getByTestId('benchmark-adaptive-error')).toHaveTextContent(
      'stopped by a restart'
    );
  });

  it('fetches a goal transcript only once its row opens and renders attempts as text', async () => {
    let goalRequests = 0;
    server.events.on('request:start', ({ request }) => {
      if (request.url.includes('/goals/')) goalRequests += 1;
    });
    renderCard();

    const rows = await screen.findAllByTestId('benchmark-adaptive-goal-row');
    expect(goalRequests).toBe(0);

    fireEvent.click(rows[0]);

    const sheet = await screen.findByTestId('benchmark-adaptive-transcript');
    const candidates = await within(sheet).findAllByTestId(
      'benchmark-adaptive-candidate'
    );
    expect(goalRequests).toBe(1);
    expect(candidates).toHaveLength(3);
    // The last attempt carries HTML-looking text; it must stay literal.
    expect(candidates[2].textContent).toContain('<img src=x onerror=alert(1)>');
    expect(sheet.querySelector('img')).toBeNull();
    expect(sheet.querySelector('a')).toBeNull();
    expect(
      within(sheet).getByTestId('benchmark-adaptive-final-candidate')
        .textContent
    ).toBe(candidates[2].textContent);

    server.events.removeAllListeners();
  });
});

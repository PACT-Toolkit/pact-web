import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { DashboardQuickProbe } from '@/src/app/dashboard/ui/DashboardQuickProbe';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const runProbe = (content: string) => {
  render(<DashboardQuickProbe />, { wrapper: SWRTestProvider });
  fireEvent.change(screen.getByPlaceholderText(/Paste a prompt/), {
    target: { value: content },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Run probe' }));
};

// The gateway answers a shed classifier with a retryable 429 instead of a
// decision; the probe must render it as a block, not "Request failed".
describe('DashboardQuickProbe - classifier_saturated', () => {
  it('renders the 429 as a block with the shared plain-words description', async () => {
    runProbe('simulate classifier saturation');

    expect(await screen.findByText('BLOCK')).toBeInTheDocument();
    expect(screen.getByText('classifier_saturated')).toBeInTheDocument();
    expect(
      screen.getByText('Classifier at capacity - retry later')
    ).toBeInTheDocument();
    expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument();
  });

  it('still reports a failed request for other non-200 answers', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/check`, () =>
        HttpResponse.json('service unavailable', { status: 503 })
      )
    );
    runProbe('anything');

    await waitFor(() =>
      expect(screen.getByText(/Request failed/)).toBeInTheDocument()
    );
    expect(screen.queryByText('BLOCK')).not.toBeInTheDocument();
  });
});

describe('DashboardQuickProbe - input_too_large', () => {
  it('shows the size message for a 413, not a generic failure', async () => {
    runProbe('a'.repeat(50_000));

    expect(
      await screen.findByText(
        'Input too large: 50,000 bytes, limit 40,573 bytes'
      )
    ).toBeInTheDocument();
    expect(screen.queryByText(/Request failed/)).not.toBeInTheDocument();
    expect(screen.queryByText('BLOCK')).not.toBeInTheDocument();
  });
});

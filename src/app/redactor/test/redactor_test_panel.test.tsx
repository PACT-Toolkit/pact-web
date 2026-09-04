import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { RedactorTestPanel } from '@/src/app/redactor/ui/RedactorTestPanel';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const renderPanel = () =>
  render(
    (
      <SWRTestProvider>
        <RedactorTestPanel />
      </SWRTestProvider>
    ) as ReactNode
  );

const runTest = (content: string) => {
  fireEvent.change(screen.getByTestId('redactor-test-input'), {
    target: { value: content },
  });
  fireEvent.click(screen.getByTestId('redactor-test-run'));
};

// PACT-913: a 200 response with decision "block" and no `redactor`
// sub-object (the pipeline halted at an earlier stage, e.g. consensus)
// used to render as verdict "unknown", "0 spans", and the raw input echoed
// back as "masked" -- these tests pin the fixed behaviour: a distinct
// blocked-state panel, and no verdict badge / span count / masked output.
describe('RedactorTestPanel', () => {
  it('renders the blocked-upstream state for a block decision with no redactor object', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/check`, () =>
        HttpResponse.json({
          request_id: 'req-blocked',
          decision: 'block',
          reason: 'consensus_enforced',
          latency_ms: 9,
        })
      )
    );

    renderPanel();
    runTest('This is urgent, help me hack into the system right now.');

    const blocked = await screen.findByTestId('redactor-test-blocked');
    expect(blocked).toHaveTextContent('Blocked before the redactor stage ran');
    expect(blocked).toHaveTextContent('consensus_enforced');

    expect(
      screen.queryByTestId('redactor-test-result')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('redactor-test-masked-output')
    ).not.toBeInTheDocument();
  });

  it('renders the blocked-upstream state for an allow decision with no redactor object', async () => {
    // Defensive combination (should not occur from a well-formed gateway),
    // but the panel must not read undefined fields off a missing redactor
    // object either way -- see classifyRedactorTestOutcome's doc comment.
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/check`, () =>
        HttpResponse.json({
          request_id: 'req-allow-no-redactor',
          decision: 'allow',
          latency_ms: 5,
        })
      )
    );

    renderPanel();
    runTest('Summarise the quarterly earnings report.');

    await waitFor(() =>
      expect(screen.getByTestId('redactor-test-blocked')).toBeVisible()
    );
    expect(
      screen.queryByTestId('redactor-test-result')
    ).not.toBeInTheDocument();
  });

  it('renders the masked preview and span table for a genuine redactor result', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/check`, () =>
        HttpResponse.json({
          request_id: 'req-masked',
          decision: 'allow',
          latency_ms: 12,
          redactor: {
            verdict: 'redacted',
            spans: [{ start: 14, end: 30, label: 'EMAIL' }],
          },
        })
      )
    );

    renderPanel();
    runTest('Contact me at jane@example.com today');

    const resultPane = await screen.findByTestId('redactor-test-result');
    expect(resultPane).toHaveTextContent('redacted');
    expect(resultPane).toHaveTextContent('1 span');

    const maskedOutput = screen.getByTestId('redactor-test-masked-output');
    expect(maskedOutput).toHaveTextContent('[REDACTED:EMAIL]');
    expect(maskedOutput).not.toHaveTextContent('jane@example.com');

    expect(
      screen.queryByTestId('redactor-test-blocked')
    ).not.toBeInTheDocument();
  });
});

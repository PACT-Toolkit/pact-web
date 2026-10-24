import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { delay, http } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BenchmarkImportCard } from '@/src/app/benchmark/ui/BenchmarkImportCard';
import { MSW_PACT_BASE } from '@/src/framework/msw';

const PREVIEW_URL = `${MSW_PACT_BASE}/gateway/v1/benchmark/imports/preview`;

/** Makes every preview request for which `hangs` is true never answer, so a
 * test can look at the card while a refetch is in flight. Requests it does
 * not match fall through to the default mock handler. */
const hangPreviewWhen = (hangs: (url: URL) => boolean) =>
  server.use(
    http.get(PREVIEW_URL, async ({ request }) => {
      if (hangs(new URL(request.url))) await delay('infinite');
    })
  );

const renderCard = () =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkImportCard
          onSubmit={vi.fn()}
          isSubmitting={false}
          disabled={false}
        />
      </SWRTestProvider>
    ) as ReactNode
  );

const inspect = async (slug: string) => {
  fireEvent.change(screen.getByTestId('benchmark-import-slug'), {
    target: { value: slug },
  });
  fireEvent.click(screen.getByTestId('benchmark-import-inspect'));
  await waitFor(() =>
    expect(
      screen.getByTestId('benchmark-import-preview-summary')
    ).toBeInTheDocument()
  );
};

describe('BenchmarkImportCard', () => {
  it('keeps Run disabled and shows the required hint when no text column is detected', async () => {
    renderCard();
    await inspect('Abirate/english_quotes');

    expect(
      screen.getByTestId('benchmark-import-text-column-hint')
    ).toHaveTextContent(
      'No text column detected - pick the column that holds the prompt text before running.'
    );
    expect(screen.getByTestId('benchmark-import-run')).toBeDisabled();
  });

  it('enables Run once a text column is picked by hand', async () => {
    renderCard();
    await inspect('Abirate/english_quotes');

    expect(screen.getByTestId('benchmark-import-run')).toBeDisabled();

    fireEvent.click(screen.getByTestId('benchmark-upload-mapping-text-column'));
    fireEvent.click(await screen.findByRole('option', { name: 'quote' }));

    expect(
      screen.queryByTestId('benchmark-import-text-column-hint')
    ).not.toBeInTheDocument();
    // No label column either, so Run stays gated behind the assume-label
    // control - pick one to isolate the text-column requirement.
    fireEvent.click(screen.getByTestId('benchmark-import-assume-label'));
    fireEvent.click(
      await screen.findByRole('option', { name: 'Allow (benign)' })
    );

    expect(screen.getByTestId('benchmark-import-run')).toBeEnabled();
  });

  it('keeps Run enabled with the normal detected-column dataset', async () => {
    renderCard();
    await inspect('deepset/prompt-injections');

    expect(
      screen.queryByTestId('benchmark-import-text-column-hint')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('benchmark-import-run')).toBeEnabled();
  });

  it('pre-fills the detected columns and per-value decisions from the preview', async () => {
    renderCard();
    await inspect('deepset/prompt-injections');

    expect(
      screen.getByTestId('benchmark-upload-mapping-text-column')
    ).toHaveTextContent('text');
    expect(
      screen.getByTestId('benchmark-upload-mapping-label-column')
    ).toHaveTextContent('label');
    expect(
      screen.getByTestId('benchmark-upload-mapping-text-column-auto')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('benchmark-upload-mapping-label-column-auto')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('benchmark-upload-mapping-value-0')
    ).toHaveTextContent('Allow');
    expect(
      screen.getByTestId('benchmark-upload-mapping-value-1')
    ).toHaveTextContent('Block');
  });

  it('pre-selects the suggested assume-label for an unlabeled dataset', async () => {
    renderCard();
    await inspect('walledai/AdvBench');

    expect(
      screen.queryByTestId('benchmark-import-score-threshold')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('benchmark-import-assume-label')
    ).toHaveTextContent('Block (attack)');
    expect(
      screen.getByTestId('benchmark-import-assume-label-auto')
    ).toBeInTheDocument();
    expect(screen.getByTestId('benchmark-import-run')).toBeEnabled();
  });

  it('shows the score threshold instead of the assume-label for a scored dataset', async () => {
    renderCard();
    await inspect('rubend18/ChatGPT-Jailbreak-Prompts');

    expect(screen.getByTestId('benchmark-import-score-threshold')).toHaveValue(
      47.5
    );
    expect(
      screen.getByTestId('benchmark-import-score-threshold-auto')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('benchmark-import-score-split')
    ).toHaveTextContent(
      '40 rows at or above -> attack, 39 below -> benign (of 79 sampled)'
    );
    expect(
      screen.queryByTestId('benchmark-import-assume-label')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('benchmark-import-run')).toBeEnabled();
  });

  it('refetches the split once a new threshold is committed', async () => {
    renderCard();
    await inspect('rubend18/ChatGPT-Jailbreak-Prompts');

    const input = screen.getByTestId('benchmark-import-score-threshold');
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() =>
      expect(
        screen.getByTestId('benchmark-import-score-split')
      ).toHaveTextContent('10 rows at or above')
    );
    expect(input).toHaveValue(80);
    expect(
      screen.queryByTestId('benchmark-import-score-threshold-auto')
    ).not.toBeInTheDocument();
  });

  it('sends the detected score column with the committed threshold', async () => {
    renderCard();
    await inspect('rubend18/ChatGPT-Jailbreak-Prompts');
    const requests: URL[] = [];
    server.use(
      http.get(PREVIEW_URL, ({ request }) => {
        requests.push(new URL(request.url));
      })
    );

    const input = screen.getByTestId('benchmark-import-score-threshold');
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].searchParams.get('score_threshold')).toBe('80');
    expect(requests[0].searchParams.get('score_column')).toBe(
      'Jailbreak Score'
    );
  });

  it('marks the preview busy until the refetched split arrives', async () => {
    renderCard();
    await inspect('rubend18/ChatGPT-Jailbreak-Prompts');

    const preview = screen.getByTestId('benchmark-import-preview');
    expect(preview).toHaveAttribute('aria-busy', 'false');

    const input = screen.getByTestId('benchmark-import-score-threshold');
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    await waitFor(() => expect(preview).toHaveAttribute('aria-busy', 'true'));
    await waitFor(() =>
      expect(
        screen.getByTestId('benchmark-import-score-split')
      ).toHaveTextContent('10 rows at or above')
    );
    await waitFor(() => expect(preview).toHaveAttribute('aria-busy', 'false'));
  });

  it('keeps the previous split visible and busy while a new threshold refetches', async () => {
    renderCard();
    await inspect('rubend18/ChatGPT-Jailbreak-Prompts');
    hangPreviewWhen((url) => url.searchParams.has('score_threshold'));

    const input = screen.getByTestId('benchmark-import-score-threshold');
    fireEvent.change(input, { target: { value: '80' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    const preview = screen.getByTestId('benchmark-import-preview');
    await waitFor(() => expect(preview).toHaveAttribute('aria-busy', 'true'));
    expect(
      screen.getByTestId('benchmark-import-score-split')
    ).toHaveTextContent(
      '40 rows at or above -> attack, 39 below -> benign (of 79 sampled)'
    );
    expect(screen.getByTestId('benchmark-import-run')).toBeDisabled();
    expect(
      screen.queryByText('Fetching dataset schema…')
    ).not.toBeInTheDocument();
  });

  it.each([
    ['slug', 'benchmark-import-slug', 'deepset/prompt-injections'],
    ['split', 'benchmark-import-split', 'test'],
    ['config', 'benchmark-import-config', 'default'],
  ])(
    'drops the previous preview while a different %s loads',
    async (_field, testId, value) => {
      renderCard();
      await inspect('rubend18/ChatGPT-Jailbreak-Prompts');
      hangPreviewWhen(() => true);

      fireEvent.change(screen.getByTestId(testId), { target: { value } });
      fireEvent.click(screen.getByTestId('benchmark-import-inspect'));

      expect(
        await screen.findByText('Fetching dataset schema…')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('benchmark-import-preview')
      ).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('benchmark-import-run')
      ).not.toBeInTheDocument();
    }
  );

  it('shows the new dataset once its own preview arrives', async () => {
    renderCard();
    await inspect('rubend18/ChatGPT-Jailbreak-Prompts');
    expect(
      screen.getByTestId('benchmark-import-score-threshold')
    ).toBeInTheDocument();

    await inspect('deepset/prompt-injections');

    expect(
      screen.queryByTestId('benchmark-import-score-threshold')
    ).not.toBeInTheDocument();
    expect(
      screen.getByTestId('benchmark-upload-mapping-label-column')
    ).toHaveTextContent('label');
    expect(screen.getByTestId('benchmark-import-preview')).toHaveAttribute(
      'aria-busy',
      'false'
    );
  });

  it('reverts an empty threshold draft on blur', async () => {
    renderCard();
    await inspect('rubend18/ChatGPT-Jailbreak-Prompts');

    const input = screen.getByTestId('benchmark-import-score-threshold');
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input).toHaveValue(47.5);
    expect(
      screen.getByTestId('benchmark-import-score-threshold-auto')
    ).toBeInTheDocument();
  });

  it('switches to the assume-label select when "No label column" is chosen', async () => {
    renderCard();
    await inspect('deepset/prompt-injections');

    expect(
      screen.queryByTestId('benchmark-import-assume-label')
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByTestId('benchmark-upload-mapping-label-column')
    );
    fireEvent.click(
      await screen.findByRole('option', { name: 'No label column' })
    );

    expect(
      screen.getByTestId('benchmark-import-assume-label')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('benchmark-upload-mapping-values')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('benchmark-upload-mapping-label-column-auto')
    ).not.toBeInTheDocument();
    // No suggestion for a dataset that has a label column: Run waits for a pick.
    expect(screen.getByTestId('benchmark-import-run')).toBeDisabled();
  });

  it('never logs the uncontrolled-to-controlled warning when a column is picked', async () => {
    // Radix's Select emits this one via console.warn (not console.error) -
    // see @radix-ui's useControllableState. Keep both spies: warn is the one
    // that actually fires for a Select outside a <form>, but a regression
    // that somehow routed it through error should still be caught.
    const consoleWarnSpy = vi
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    renderCard();
    await inspect('Abirate/english_quotes');

    fireEvent.click(screen.getByTestId('benchmark-upload-mapping-text-column'));
    fireEvent.click(await screen.findByRole('option', { name: 'quote' }));

    const isUncontrolledWarning = ([message]: unknown[]) =>
      typeof message === 'string' &&
      message.includes('changing from uncontrolled to controlled');

    expect(consoleWarnSpy.mock.calls.filter(isUncontrolledWarning)).toEqual([]);
    expect(consoleErrorSpy.mock.calls.filter(isUncontrolledWarning)).toEqual(
      []
    );

    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

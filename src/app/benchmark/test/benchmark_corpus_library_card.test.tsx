import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BenchmarkCorpusLibraryCard } from '@/src/app/benchmark/ui/BenchmarkCorpusLibraryCard';

const renderCard = () =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkCorpusLibraryCard />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('BenchmarkCorpusLibraryCard', () => {
  it('renders the datasets in the server-given order with formatted totals', async () => {
    renderCard();

    await waitFor(() =>
      expect(screen.getByText('575,643')).toBeInTheDocument()
    );

    const rows = screen.getAllByRole('row').slice(1); // drop header row
    const datasetNames = rows.map(
      (row) => row.querySelector('td')?.textContent
    );

    expect(datasetNames).toEqual([
      'hackaprompt/hackaprompt-dataset',
      'Lakera/mosscap_prompt_injection',
      'HuggingFaceH4/ultrachat_200k',
      'fka/awesome-chatgpt-prompts',
      'deepset/prompt-injections',
      'beratcmn/turkish-prompt-injections',
      'rubend18/ChatGPT-Jailbreak-Prompts',
      'imoxto/prompt_injection_cleaned_dataset',
      'cgoosen/prompt_injection_password_or_secret',
    ]);

    // First row's total rows and block/allow split are formatted with
    // thousands separators.
    expect(screen.getByText('377,850 / 0')).toBeInTheDocument();
  });

  it('shows an empty-library message pointing at the ingest CLI when total_rows is 0', async () => {
    server.use(
      http.get('*/api/pact/gateway/v1/benchmark/corpus/library', () =>
        HttpResponse.json({ total_rows: 0, datasets: [] })
      )
    );

    renderCard();

    await waitFor(() =>
      expect(
        screen.getByText('No corpus data ingested yet.')
      ).toBeInTheDocument()
    );
    expect(screen.getByText('benchmark corpus ingest')).toBeInTheDocument();
  });

  it('shows an error state on a non-200 response', async () => {
    server.use(
      http.get(
        '*/api/pact/gateway/v1/benchmark/corpus/library',
        () => new HttpResponse('internal error', { status: 502 })
      )
    );

    renderCard();

    await waitFor(() =>
      expect(
        screen.getByText("Couldn't load the corpus library.")
      ).toBeInTheDocument()
    );
  });
});

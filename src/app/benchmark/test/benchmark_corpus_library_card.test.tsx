import { render, screen, waitFor, within } from '@testing-library/react';
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
  it('renders the datasets as composition rows in the server-given order with formatted totals', async () => {
    renderCard();

    await waitFor(() =>
      expect(screen.getByText('575,643')).toBeInTheDocument()
    );

    const rows = screen.getAllByTestId('benchmark-corpus-composition-row');
    const datasetNames = rows.map((row) => row.querySelector('p')?.textContent);

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
    // thousands separators, and its bar is entirely block share (0 allow).
    expect(within(rows[0]).getByText('377,850')).toBeInTheDocument();
    expect(
      within(rows[0]).getByText('377,850 block / 0 allow')
    ).toBeInTheDocument();
    expect(
      within(rows[0]).getByRole('img', {
        name: 'hackaprompt/hackaprompt-dataset: 100% block, 0% allow',
      })
    ).toBeInTheDocument();
  });

  it('shows a role badge per dataset, including the unknown state for an empty role', async () => {
    server.use(
      http.get('*/api/pact/gateway/v1/benchmark/corpus/library', () =>
        HttpResponse.json({
          total_rows: 300,
          datasets: [
            {
              source_dataset: 'a/training-set',
              license: 'MIT',
              category: 'benign-chat',
              total_rows: 100,
              block_rows: 0,
              allow_rows: 100,
              role: 'training',
            },
            {
              source_dataset: 'b/eval-set',
              license: 'MIT',
              category: 'prompt-hacking',
              total_rows: 100,
              block_rows: 100,
              allow_rows: 0,
              role: 'evaluation',
            },
            {
              source_dataset: 'c/unbackfilled-set',
              license: 'MIT',
              category: 'prompt-hacking',
              total_rows: 100,
              block_rows: 100,
              allow_rows: 0,
              role: '',
            },
          ],
        })
      )
    );

    renderCard();

    await waitFor(() =>
      expect(screen.getByText('a/training-set')).toBeInTheDocument()
    );

    expect(screen.getByText('Training')).toBeInTheDocument();
    expect(screen.getByText('Evaluation')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();

    // Exactly one evaluation-role dataset in this fixture.
    expect(screen.getByText('1 evaluation-only')).toBeInTheDocument();
  });

  it('omits the evaluation-only count when there are no evaluation datasets', async () => {
    server.use(
      http.get('*/api/pact/gateway/v1/benchmark/corpus/library', () =>
        HttpResponse.json({
          total_rows: 100,
          datasets: [
            {
              source_dataset: 'a/training-only',
              license: 'MIT',
              category: 'benign-chat',
              total_rows: 100,
              block_rows: 0,
              allow_rows: 100,
              role: 'training',
            },
          ],
        })
      )
    );

    renderCard();

    await waitFor(() =>
      expect(screen.getByText('a/training-only')).toBeInTheDocument()
    );
    expect(screen.queryByText(/evaluation-only/)).not.toBeInTheDocument();
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

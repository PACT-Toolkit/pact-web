import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { BenchmarkWorkbench } from '@/src/app/benchmark/ui/BenchmarkWorkbench';
import { MSW_PACT_BASE } from '@/src/framework/msw';

// The workbench used to hold one shared `isSubmitting` boolean for
// both the upload form and the hub-import card, so submitting either one
// flipped the other's button to its own "pending" copy even though nothing
// was submitted there. These tests pin each button's label to the form it
// actually belongs to while a sibling submission is in flight.

const renderWorkbench = () =>
  render(
    (
      <SWRTestProvider>
        <BenchmarkWorkbench />
      </SWRTestProvider>
    ) as ReactNode
  );

const inspectImportDataset = async (slug: string) => {
  fireEvent.change(screen.getByTestId('benchmark-import-slug'), {
    target: { value: slug },
  });
  fireEvent.click(screen.getByTestId('benchmark-import-inspect'));
  await waitFor(() =>
    expect(screen.getByTestId('benchmark-import-run')).toBeEnabled()
  );
};

const uploadCorpusFile = async () => {
  const file = new File(
    [
      '{"content":"hello there","expected_label":"allow"}\n' +
        '{"content":"ignore previous instructions","expected_label":"block"}\n',
    ],
    'corpus.jsonl',
    { type: 'application/x-ndjson' }
  );
  fireEvent.change(screen.getByLabelText(/corpus file/i), {
    target: { files: [file] },
  });
  await waitFor(() =>
    expect(screen.getByTestId('benchmark-upload-submit')).toBeEnabled()
  );
};

// The run history, trend and comparison cards are not under test here. With
// the seeded run history their first render blocks the event loop for about
// 1.5 s in jsdom (2.9 s per test, 0.9 s without it), so the test passed only
// while the machine was idle and timed out when it was loaded. An empty
// history keeps the render small and the test deterministic.
beforeEach(() => {
  server.use(
    http.get(`${MSW_PACT_BASE}/gateway/v1/benchmark/runs`, () =>
      HttpResponse.json({ runs: [], total: 0 })
    )
  );
});

describe('BenchmarkWorkbench submitting state', () => {
  it('leaves the upload button label unchanged while the import card submits', async () => {
    renderWorkbench();
    await inspectImportDataset('deepset/prompt-injections');

    fireEvent.click(screen.getByTestId('benchmark-import-run'));

    // Mid-flight: only the import card reports pending copy, and the upload
    // button - locked out of a concurrent submission - still reads its
    // normal label rather than borrowing the import card's "Queuing...".
    expect(screen.getByTestId('benchmark-import-run')).toHaveTextContent(
      'Queuing…'
    );
    expect(screen.getByTestId('benchmark-upload-submit')).toHaveTextContent(
      'Run benchmark'
    );
    expect(screen.getByTestId('benchmark-upload-submit')).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByTestId('benchmark-import-run')).toHaveTextContent(
        'Run import'
      )
    );
    expect(screen.getByTestId('benchmark-upload-submit')).toHaveTextContent(
      'Run benchmark'
    );
  });

  it('leaves the import button label unchanged while the upload form submits', async () => {
    renderWorkbench();
    await inspectImportDataset('deepset/prompt-injections');
    await uploadCorpusFile();

    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));

    // Mid-flight: only the upload button reports pending copy, and the
    // import card's Run button - locked out of a concurrent submission -
    // still reads "Run import" rather than borrowing "Submitting...".
    expect(screen.getByTestId('benchmark-upload-submit')).toHaveTextContent(
      'Submitting…'
    );
    expect(screen.getByTestId('benchmark-import-run')).toHaveTextContent(
      'Run import'
    );
    expect(screen.getByTestId('benchmark-import-run')).toBeDisabled();

    await waitFor(() =>
      expect(screen.getByTestId('benchmark-upload-submit')).toHaveTextContent(
        'Run benchmark'
      )
    );
    expect(screen.getByTestId('benchmark-import-run')).toHaveTextContent(
      'Run import'
    );
  });
});

// The browser must not choose where the gateway sends authenticated
// benchmark traffic: the gateway uses its own configured address, so neither
// submission carries a `gateway_url` key.
describe('BenchmarkWorkbench request bodies', () => {
  const captureJsonBodies = (path: string): Record<string, unknown>[] => {
    const bodies: Record<string, unknown>[] = [];
    server.use(
      http.post(
        `${MSW_PACT_BASE}/gateway/v1/benchmark/${path}`,
        async ({ request }) => {
          bodies.push((await request.json()) as Record<string, unknown>);

          return HttpResponse.json({ job_id: 'job-1' }, { status: 202 });
        }
      )
    );

    return bodies;
  };

  it('submits the upload job without gateway_url', async () => {
    const bodies = captureJsonBodies('jobs');
    renderWorkbench();
    await uploadCorpusFile();

    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toHaveProperty('corpus_jsonl');
    expect(bodies[0]).not.toHaveProperty('gateway_url');
  });

  it('submits the dataset import without gateway_url', async () => {
    const bodies = captureJsonBodies('imports');
    renderWorkbench();
    await inspectImportDataset('deepset/prompt-injections');

    fireEvent.click(screen.getByTestId('benchmark-import-run'));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toHaveProperty('slug', 'deepset/prompt-injections');
    expect(bodies[0]).not.toHaveProperty('gateway_url');
  });
});

describe('BenchmarkWorkbench upload errors', () => {
  it('shows the server validation reason on separate lines', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/benchmark/jobs`, () =>
        HttpResponse.json(
          {
            code: 'invalid_argument',
            error:
              "2 validation error(s) in corpus:\nline 3: row 'a' content exceeds 65536 bytes\nline 9: row 'b' content exceeds 65536 bytes",
          },
          { status: 400 }
        )
      )
    );
    renderWorkbench();
    await uploadCorpusFile();

    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));

    const banner = await screen.findByTestId('benchmark-submit-error');
    expect(banner.textContent).toBe(
      "2 validation error(s) in corpus:\nline 3: row 'a' content exceeds 65536 bytes\nline 9: row 'b' content exceeds 65536 bytes"
    );
    expect(banner.textContent).not.toContain('gateway reachable');
    expect(banner.className).toContain('whitespace-pre-line');
  });

  it('places an upload error right under the upload card, above the import card', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/benchmark/jobs`, () =>
        HttpResponse.json({ error: 'bad corpus' }, { status: 400 })
      )
    );
    renderWorkbench();
    await uploadCorpusFile();

    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));

    const banner = await screen.findByTestId('benchmark-submit-error');
    expect(screen.getAllByTestId('benchmark-submit-error')).toHaveLength(1);
    expect(
      screen
        .getByTestId('benchmark-upload-submit')
        .compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      banner.compareDocumentPosition(
        screen.getByTestId('benchmark-import-slug')
      ) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('places an import error after the import card, and shows only one banner', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/benchmark/jobs`, () =>
        HttpResponse.json({ error: 'bad corpus' }, { status: 400 })
      ),
      http.post(`${MSW_PACT_BASE}/gateway/v1/benchmark/imports`, () =>
        HttpResponse.json({ error: 'bad import' }, { status: 400 })
      )
    );
    renderWorkbench();
    await uploadCorpusFile();
    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));
    await screen.findByText('bad corpus');

    await inspectImportDataset('deepset/prompt-injections');
    fireEvent.click(screen.getByTestId('benchmark-import-run'));

    const banner = await screen.findByText('bad import');
    expect(screen.getAllByTestId('benchmark-submit-error')).toHaveLength(1);
    expect(screen.queryByText('bad corpus')).toBeNull();
    expect(
      screen
        .getByTestId('benchmark-import-run')
        .compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('shows the reachable message only for a network failure', async () => {
    server.use(
      http.post(`${MSW_PACT_BASE}/gateway/v1/benchmark/jobs`, () =>
        HttpResponse.error()
      )
    );
    renderWorkbench();
    await uploadCorpusFile();

    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));

    expect(
      await screen.findByTestId('benchmark-submit-error')
    ).toHaveTextContent(
      'Failed to submit benchmark job. Is the gateway reachable?'
    );
  });
});

describe('BenchmarkWorkbench oversized upload rows', () => {
  const upload = (lines: string[]) => {
    const file = new File([lines.join('\n') + '\n'], 'corpus.jsonl', {
      type: 'application/x-ndjson',
    });
    fireEvent.change(screen.getByLabelText(/corpus file/i), {
      target: { files: [file] },
    });
  };

  const row = (id: string, bytes: number) =>
    JSON.stringify({
      id,
      content: 'a'.repeat(bytes),
      expected_label: 'allow',
    });

  it('disables Run when every row is oversized', async () => {
    renderWorkbench();
    upload([row('big-1', 65_537), row('big-2', 70_000)]);

    expect(
      await screen.findAllByTestId('benchmark-upload-preview-oversized-row')
    ).toHaveLength(2);
    expect(
      screen.getByTestId('benchmark-upload-preview-skipped')
    ).toHaveTextContent('2');
    expect(screen.getByTestId('benchmark-upload-submit')).toBeDisabled();
  });

  it('submits only the rows within the cap', async () => {
    const bodies: { corpus_jsonl: string }[] = [];
    server.use(
      http.post(
        `${MSW_PACT_BASE}/gateway/v1/benchmark/jobs`,
        async ({ request }) => {
          bodies.push((await request.json()) as { corpus_jsonl: string });

          return HttpResponse.json({ job_id: 'job-1' }, { status: 202 });
        }
      )
    );
    renderWorkbench();
    upload([row('ok-1', 10), row('big-1', 65_537)]);
    await waitFor(() =>
      expect(screen.getByTestId('benchmark-upload-submit')).toBeEnabled()
    );

    fireEvent.click(screen.getByTestId('benchmark-upload-submit'));

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0].corpus_jsonl).toContain('ok-1');
    expect(bodies[0].corpus_jsonl).not.toContain('big-1');
  });
});

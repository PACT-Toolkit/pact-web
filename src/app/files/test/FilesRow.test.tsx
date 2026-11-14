import { render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { SWRConfig } from 'swr';
import { describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';
import { type FilesFileResponse } from '@/src/__codegen__/rest/files';
import { FilesRow } from '@/src/app/files/ui/FilesRow';

const renderRow = (file: FilesFileResponse) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      <ul>
        <FilesRow file={file} onListChange={() => undefined} />
      </ul>
    </SWRConfig>
  );

const readyFile = (
  overrides: Partial<FilesFileResponse>
): FilesFileResponse => ({
  id: 'f1',
  filename: 'notes.txt',
  contentType: 'text/plain',
  sizeBytes: 100,
  status: 'ready',
  ...overrides,
});

describe('FilesRow download', () => {
  it('withholds the download of a blocked file without calling the API or showing an error', async () => {
    const mint = vi.fn();
    server.use(
      http.get('*/v1/files/:id', () => {
        mint();

        return HttpResponse.json({ file: {} });
      })
    );

    renderRow(
      readyFile({
        scanStatus: 'blocked',
        scanStage: 'filter',
        scanReason: 'filter_hostile',
      })
    );

    expect(screen.getByTestId('files-row-download-withheld')).toHaveTextContent(
      'Download withheld: the scan blocked this file.'
    );
    expect(screen.queryByText('Download')).not.toBeInTheDocument();
    expect(screen.queryByText(/lookup failed|network error/)).toBeNull();
    expect(
      screen.queryByRole('button', { name: /Retry download link/ })
    ).toBeNull();
    // Give an erroneous mint time to fire before asserting it never did.
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(mint).not.toHaveBeenCalled();
  });

  it('still mints and offers the download for a ready, scanned file', async () => {
    server.use(
      http.get('*/v1/files/:id', () =>
        HttpResponse.json({ file: {}, downloadUrl: 'https://x.test/f?sig=1' })
      )
    );

    renderRow(readyFile({ scanStatus: 'allowed' }));

    const link = await screen.findByText('Download');
    expect(link).toHaveAttribute('href', 'https://x.test/f?sig=1');
    expect(screen.queryByTestId('files-row-download-withheld')).toBeNull();
  });

  it('keeps the lookup-failed retry for a non-blocked file', async () => {
    server.use(
      http.get('*/v1/files/:id', () =>
        HttpResponse.json({ error: 'boom' }, { status: 500 })
      )
    );

    renderRow(readyFile({ scanStatus: 'skipped' }));

    await waitFor(() =>
      expect(screen.getByText(/lookup failed|network error/)).toBeVisible()
    );
  });
});

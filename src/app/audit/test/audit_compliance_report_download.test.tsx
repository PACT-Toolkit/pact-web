import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { server } from '@/mocks/server';
import { AuditComplianceReportDownload } from '@/src/app/audit/ui/AuditComplianceReportDownload';
import * as download from '@/src/framework/helpers/download';

const wireEntry = (n: number) => ({
  eventUuid: `evt-${n}`,
  requestId: `req-${n}`,
  decision: 'block',
  engine: 'filter',
  createdAt: `2026-10-17T10:00:${String(59 - (n % 60)).padStart(2, '0')}Z`,
  controls: [],
});

const pageHandler = (total: number, failFromOffset?: number) =>
  http.get('*/v1/audit/compliance-report', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const offset = Number(params.get('offset'));
    const limit = Number(params.get('limit'));
    if (failFromOffset !== undefined && offset >= failFromOffset) {
      return HttpResponse.json({ error: 'boom' }, { status: 500 });
    }
    const entries = [];
    for (let i = offset; i < Math.min(offset + limit, total); i++) {
      entries.push(wireEntry(i));
    }

    return HttpResponse.json({ entries, total, sinceUnix: 1, untilUnix: 2 });
  });

describe('AuditComplianceReportDownload', () => {
  let triggerDownload: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    triggerDownload = vi
      .spyOn(download, 'triggerDownload')
      .mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderButton = (rowCeiling?: number) =>
    render(
      <AuditComplianceReportDownload
        sinceUnix={1}
        untilUnix={2}
        rowCeiling={rowCeiling}
      />
    );

  it('downloads a file once every page is collected', async () => {
    server.use(pageHandler(450));
    renderButton();

    fireEvent.click(screen.getByTestId('audit-compliance-download'));

    await waitFor(() => expect(triggerDownload).toHaveBeenCalledOnce());
    const [blob, filename] = triggerDownload.mock.calls[0] as [Blob, string];
    expect(filename).toBe('pact-compliance-report-1-2.json');
    const report = JSON.parse(await blob.text()) as { entries: unknown[] };
    expect(report.entries).toHaveLength(450);
    expect(screen.getByTestId('audit-compliance-download')).toBeEnabled();
  });

  it('shows pages and rows while collecting and stays disabled', async () => {
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get('*/v1/audit/compliance-report', async ({ request }) => {
        const offset = Number(new URL(request.url).searchParams.get('offset'));
        if (offset > 0) await gate;

        return HttpResponse.json({
          entries: [wireEntry(0), wireEntry(1)],
          total: 4,
          sinceUnix: 1,
          untilUnix: 2,
        });
      })
    );
    renderButton();

    fireEvent.click(screen.getByTestId('audit-compliance-download'));

    const button = screen.getByTestId('audit-compliance-download');
    await waitFor(() =>
      expect(button).toHaveTextContent('Collecting page 1: 2 of 4 rows')
    );
    expect(button).toBeDisabled();
    release();
    await waitFor(() => expect(button).toHaveTextContent('Download report'));
  });

  it('produces no file and states the cut-off at the row ceiling', async () => {
    server.use(pageHandler(1_000));
    renderButton(400);

    fireEvent.click(screen.getByTestId('audit-compliance-download'));

    const notice = await screen.findByTestId(
      'audit-compliance-download-notice'
    );
    expect(notice).toHaveTextContent(
      'No file produced: the 400-row limit was reached after 400 rows.'
    );
    expect(notice).toHaveTextContent(
      'recorded at 2026-10-17 10:00:20 UTC. Narrow the window so Until is before that time'
    );
    expect(triggerDownload).not.toHaveBeenCalled();
  });

  it('names the page reached when the server fails mid-walk', async () => {
    server.use(pageHandler(1_000, 400));
    renderButton();

    fireEvent.click(screen.getByTestId('audit-compliance-download'));

    expect(
      await screen.findByTestId('audit-compliance-download-error')
    ).toHaveTextContent(
      'Failed to collect the compliance report at page 3. No file was produced.'
    );
    expect(triggerDownload).not.toHaveBeenCalled();
  });
});

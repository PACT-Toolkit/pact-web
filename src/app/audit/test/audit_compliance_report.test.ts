import { describe, expect, it, vi } from 'vitest';

import {
  collectComplianceReportPages,
  complianceCeilingMessage,
  type ComplianceReportDocument,
  COMPLIANCE_REPORT_PAGE_SIZE,
  complianceReportFilename,
  ComplianceReportHttpError,
  defaultComplianceWindow,
  toComplianceReportEntry,
  type ComplianceReportWalkResult,
} from '@/src/app/audit/domain/audit_compliance_report';
import { retryOnRateLimit } from '@/src/framework/http';

const wireEntry = (n: number) => ({
  eventUuid: `evt-${n}`,
  requestId: `req-${n}`,
  decision: 'block',
  engine: 'filter',
  createdAt: '2026-10-17T10:00:00Z',
  controls: [{ framework: 'owasp_llm_top10', controlId: 'LLM01' }],
});

const reportWindow = { sinceUnix: 100, untilUnix: 200 };

describe('toComplianceReportEntry', () => {
  it('maps the RFC3339 createdAt to unix seconds and copies controls', () => {
    expect(toComplianceReportEntry(wireEntry(1))).toEqual({
      eventUuid: 'evt-1',
      requestId: 'req-1',
      decision: 'block',
      engine: 'filter',
      createdAtUnix: Date.parse('2026-10-17T10:00:00Z') / 1000,
      controls: [{ framework: 'owasp_llm_top10', controlId: 'LLM01' }],
    });
  });

  it('floors fractional seconds', () => {
    const entry = toComplianceReportEntry({
      ...wireEntry(1),
      createdAt: '2026-10-17T10:00:00.999Z',
    });

    expect(entry.createdAtUnix).toBe(Date.parse('2026-10-17T10:00:00Z') / 1000);
  });

  it('maps an unparsable createdAt to 0 and defaults absent fields', () => {
    expect(
      toComplianceReportEntry({ ...wireEntry(1), createdAt: 'not a date' })
        .createdAtUnix
    ).toBe(0);
    expect(toComplianceReportEntry({})).toEqual({
      eventUuid: '',
      requestId: '',
      decision: '',
      engine: '',
      createdAtUnix: 0,
      controls: [],
    });
  });
});

const walkOptions = { ...reportWindow, generatedAtUnix: 300 };

const completedChunks = (result: ComplianceReportWalkResult): string[] => {
  if (result.status !== 'completed') {
    throw new Error(`expected completed, got ${result.status}`);
  }

  return result.chunks;
};

const referenceFile = (wire: ReturnType<typeof wireEntry>[]): string =>
  JSON.stringify(
    {
      generatedAtUnix: 300,
      sinceUnix: 100,
      untilUnix: 200,
      entries: wire.map(toComplianceReportEntry),
    } satisfies ComplianceReportDocument,
    null,
    2
  );

describe('collectComplianceReportPages', () => {
  it('returns a single page when it already holds every entry', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ entries: [wireEntry(1), wireEntry(2)], total: 2 });
    const onProgress = vi.fn();

    const result = await collectComplianceReportPages(fetchPage, {
      ...walkOptions,
      onProgress,
    });

    expect(result).toMatchObject({ status: 'completed', rows: 2, total: 2 });
    expect(fetchPage).toHaveBeenCalledExactlyOnceWith({
      ...reportWindow,
      limit: COMPLIANCE_REPORT_PAGE_SIZE,
      offset: 0,
    });
    expect(onProgress).toHaveBeenCalledExactlyOnceWith({
      pages: 1,
      rows: 2,
      total: 2,
    });
  });

  it('advances the offset across pages and reports progress after each', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({
        entries: [wireEntry(1), wireEntry(2)],
        total: 5,
      })
      .mockResolvedValueOnce({
        entries: [wireEntry(3), wireEntry(4)],
        total: 5,
      })
      .mockResolvedValueOnce({ entries: [wireEntry(5)], total: 5 });
    const onProgress = vi.fn();

    const result = await collectComplianceReportPages(fetchPage, {
      ...walkOptions,
      onProgress,
    });

    expect(result).toMatchObject({ status: 'completed', rows: 5, total: 5 });
    expect(fetchPage.mock.calls.map(([params]) => params.offset)).toEqual([
      0, 2, 4,
    ]);
    expect(onProgress.mock.calls.map(([progress]) => progress)).toEqual([
      { pages: 1, rows: 2, total: 5 },
      { pages: 2, rows: 4, total: 5 },
      { pages: 3, rows: 5, total: 5 },
    ]);
  });

  it('walks 500 pages with no page cap', async () => {
    const pageSize = 2;
    const total = 500 * pageSize;
    const fetchPage = vi.fn(async ({ offset }: { offset: number }) => ({
      entries: [wireEntry(offset), wireEntry(offset + 1)],
      total,
    }));

    const result = await collectComplianceReportPages(fetchPage, {
      ...walkOptions,
      pageSize,
    });

    expect(fetchPage).toHaveBeenCalledTimes(500);
    expect(result).toMatchObject({ status: 'completed', rows: total });
  });

  it('stops on an empty page even when total promises more', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ entries: [wireEntry(1)], total: 10 })
      .mockResolvedValueOnce({ entries: [], total: 10 });

    const result = await collectComplianceReportPages(fetchPage, walkOptions);

    expect(result).toMatchObject({ status: 'completed', rows: 1, total: 10 });
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('completes an empty window as a valid empty report', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ entries: [], total: 0 });

    const result = await collectComplianceReportPages(fetchPage, walkOptions);

    expect(completedChunks(result).join('')).toBe(referenceFile([]));
  });

  it('reports the ceiling with the exact rows and the last row timestamp', async () => {
    const pageSize = 2;
    const fetchPage = vi.fn(async ({ offset }: { offset: number }) => ({
      entries: [
        { ...wireEntry(offset), createdAt: `2026-10-17T10:00:0${offset}Z` },
        {
          ...wireEntry(offset + 1),
          createdAt: `2026-10-17T10:00:0${offset + 1}Z`,
        },
      ],
      total: 1_000,
    }));

    const result = await collectComplianceReportPages(fetchPage, {
      ...walkOptions,
      pageSize,
      rowCeiling: 6,
    });

    expect(result).toEqual({
      status: 'ceiling',
      rows: 6,
      total: 1_000,
      lastCreatedAt: '2026-10-17T10:00:05Z',
    });
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('completes, not ceiling, when the last page lands exactly on the ceiling', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ entries: [wireEntry(1), wireEntry(2)], total: 2 });

    const result = await collectComplianceReportPages(fetchPage, {
      ...walkOptions,
      rowCeiling: 2,
    });

    expect(result.status).toBe('completed');
  });

  it('serializes byte-identically to JSON.stringify of the document', async () => {
    const wire = [wireEntry(1), wireEntry(2), wireEntry(3)];
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ entries: wire.slice(0, 2), total: 3 })
      .mockResolvedValueOnce({ entries: wire.slice(2), total: 3 });

    const result = await collectComplianceReportPages(fetchPage, walkOptions);

    const chunks = completedChunks(result);
    expect(chunks).toHaveLength(4);
    expect(chunks.join('')).toBe(referenceFile(wire));
  });

  it('reports the 1-based page whose fetch failed', async () => {
    const boom = new Error('boom');
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ entries: [wireEntry(1)], total: 5 })
      .mockResolvedValueOnce({ entries: [wireEntry(2)], total: 5 })
      .mockRejectedValueOnce(boom);

    const result = await collectComplianceReportPages(fetchPage, walkOptions);

    expect(result).toEqual({ status: 'failed', page: 3, error: boom });
  });

  it('reports page 1 when the first fetch fails', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error('boom'));

    expect(
      await collectComplianceReportPages(fetchPage, walkOptions)
    ).toMatchObject({ status: 'failed', page: 1 });
  });
});

describe('complianceCeilingMessage', () => {
  it('states the row count, the last timestamp and the narrow-window prompt', () => {
    expect(
      complianceCeilingMessage(250_000, '2026-10-17T10:00:00Z', 250_000)
    ).toBe(
      'No file produced: the 250,000-row limit was reached after 250,000 rows. The last row fetched was recorded at 2026-10-17 10:00:00 UTC. Narrow the window so Until is before that time, then download again.'
    );
  });
});

describe('complianceCeilingMessage cut-off fallback', () => {
  it('prints an unparsable timestamp as received and an empty one as unknown', () => {
    expect(complianceCeilingMessage(5, 'garbage', 5)).toContain(
      'recorded at garbage.'
    );
    expect(complianceCeilingMessage(5, '', 5)).toContain(
      'recorded at an unknown time.'
    );
  });
});

describe('complianceReportFilename', () => {
  it('embeds the window bounds', () => {
    expect(complianceReportFilename(100, 200)).toBe(
      'pact-compliance-report-100-200.json'
    );
  });
});

describe('defaultComplianceWindow', () => {
  it('spans the 24 hours ending at now as datetime-local values', () => {
    const now = new Date(2026, 9, 17, 14, 35, 59).getTime();

    expect(defaultComplianceWindow(now)).toEqual({
      since: '2026-10-16T14:35',
      until: '2026-10-17T14:35',
    });
  });
});

describe('ComplianceReportHttpError', () => {
  const params = { sinceUnix: 1, untilUnix: 2, limit: 200, offset: 0 };

  it('carries the status and the Retry-After header value', () => {
    const error = new ComplianceReportHttpError(429, '7');

    expect(error).toMatchObject({ status: 429, retryAfter: '7' });
    expect(new ComplianceReportHttpError(500).retryAfter).toBeNull();
  });

  it('is retried by the shared 429 policy, honouring its Retry-After', async () => {
    const page = { entries: [wireEntry(1)], total: 1 };
    const fetchPage = vi
      .fn()
      .mockRejectedValueOnce(new ComplianceReportHttpError(429, '3'))
      .mockResolvedValueOnce(page);
    const sleep = vi.fn().mockResolvedValue(undefined);

    const result = await retryOnRateLimit(() => fetchPage(params), { sleep });

    expect(result).toEqual(page);
    expect(sleep.mock.calls).toEqual([[3000]]);
  });
});

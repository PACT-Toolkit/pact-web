import { describe, expect, it, vi } from 'vitest';

import {
  buildComplianceReport,
  collectComplianceReportPages,
  COMPLIANCE_REPORT_MAX_PAGES,
  COMPLIANCE_REPORT_PAGE_SIZE,
  complianceReportFilename,
  ComplianceReportHttpError,
  defaultComplianceWindow,
  toComplianceReportEntry,
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

describe('collectComplianceReportPages', () => {
  it('returns a single page when it already holds every entry', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ entries: [wireEntry(1), wireEntry(2)], total: 2 });
    const onProgress = vi.fn();

    const result = await collectComplianceReportPages(
      fetchPage,
      reportWindow,
      onProgress
    );

    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({
      ...reportWindow,
      limit: COMPLIANCE_REPORT_PAGE_SIZE,
      offset: 0,
    });
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(2, 2);
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

    const result = await collectComplianceReportPages(
      fetchPage,
      reportWindow,
      onProgress
    );

    expect(result.entries.map((entry) => entry.eventUuid)).toEqual([
      'evt-1',
      'evt-2',
      'evt-3',
      'evt-4',
      'evt-5',
    ]);
    expect(fetchPage.mock.calls.map(([params]) => params.offset)).toEqual([
      0, 2, 4,
    ]);
    expect(onProgress.mock.calls).toEqual([
      [2, 5],
      [4, 5],
      [5, 5],
    ]);
  });

  it('stops on an empty page even when total promises more', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValueOnce({ entries: [wireEntry(1)], total: 10 })
      .mockResolvedValueOnce({ entries: [], total: 10 });

    const result = await collectComplianceReportPages(fetchPage, reportWindow);

    expect(result.entries).toHaveLength(1);
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('returns an empty result for an empty window', async () => {
    const fetchPage = vi.fn().mockResolvedValue({ entries: [], total: 0 });

    expect(await collectComplianceReportPages(fetchPage, reportWindow)).toEqual(
      { entries: [], total: 0, truncated: false }
    );
  });

  it('stops after the page cap when total never converges', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ entries: [wireEntry(1)], total: 1_000_000 });

    const result = await collectComplianceReportPages(fetchPage, reportWindow);

    expect(fetchPage).toHaveBeenCalledTimes(COMPLIANCE_REPORT_MAX_PAGES);
    expect(result.entries).toHaveLength(COMPLIANCE_REPORT_MAX_PAGES);
    expect(result.truncated).toBe(true);
  });

  it('is not truncated when every entry arrived', async () => {
    const fetchPage = vi
      .fn()
      .mockResolvedValue({ entries: [wireEntry(1)], total: 1 });

    const result = await collectComplianceReportPages(fetchPage, reportWindow);

    expect(result.truncated).toBe(false);
  });

  it('propagates a fetch failure', async () => {
    const fetchPage = vi.fn().mockRejectedValue(new Error('boom'));

    await expect(
      collectComplianceReportPages(fetchPage, reportWindow)
    ).rejects.toThrow('boom');
  });
});

describe('buildComplianceReport', () => {
  it('assembles the document with mapped entries', () => {
    const report = buildComplianceReport({
      generatedAtUnix: 300,
      sinceUnix: 100,
      untilUnix: 200,
      entries: [wireEntry(1)],
    });

    expect(Object.keys(report)).toEqual([
      'generatedAtUnix',
      'sinceUnix',
      'untilUnix',
      'entries',
    ]);
    expect(report.generatedAtUnix).toBe(300);
    expect(report.entries).toEqual([toComplianceReportEntry(wireEntry(1))]);
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

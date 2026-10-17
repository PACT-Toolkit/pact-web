import { describe, expect, it } from 'vitest';

import { type AuditAuditEventResponse } from '@/src/__codegen__/rest/audit';
import {
  computeComplianceReport,
  computeControlStats,
  eventsInUnixWindow,
} from '@/src/app/audit/mock/data/audit_compliance_aggregate';

const LLM01 = { framework: 'owasp_llm_top10', id: 'LLM01' };
const LLM02 = { framework: 'owasp_llm_top10', id: 'LLM02' };

const decision = (
  n: number,
  createdUnix: number,
  verdict: 'allow' | 'block',
  controls: { framework: string; id: string }[]
): AuditAuditEventResponse => ({
  id: `row-${n}`,
  requestId: `req-${n}`,
  createdAt: new Date(createdUnix * 1000).toISOString(),
  payloadJson: JSON.stringify({
    event_uuid: `evt-${n}`,
    decision: verdict,
    engine: 'filter',
    filter: { controls },
  }),
});

const events = [
  decision(1, 1000, 'block', [LLM01]),
  decision(2, 1100, 'allow', [LLM01, LLM02]),
  decision(3, 1200, 'block', [LLM02]),
  decision(4, 1300, 'allow', []),
  decision(5, 1400, 'block', [LLM01]),
];

describe('eventsInUnixWindow', () => {
  it('treats since as inclusive and until as exclusive', () => {
    const inWindow = eventsInUnixWindow(events, {
      sinceUnix: 1100,
      untilUnix: 1400,
    });

    expect(inWindow.map((event) => event.id)).toEqual([
      'row-2',
      'row-3',
      'row-4',
    ]);
  });

  it('keeps everything when no bound is given', () => {
    expect(eventsInUnixWindow(events, {})).toHaveLength(events.length);
  });
});

describe('computeControlStats', () => {
  it('counts totals per control split by verdict, with unmapped separate', () => {
    const { stats, unmapped } = computeControlStats(events);

    const byId = Object.fromEntries(
      (stats ?? []).map((stat) => [stat.controlId, stat])
    );
    expect(byId.LLM01).toMatchObject({ total: 3, allow: 1, block: 2 });
    expect(byId.LLM02).toMatchObject({ total: 2, allow: 1, block: 1 });
    expect(unmapped).toMatchObject({ total: 1, allow: 1, block: 0 });
  });

  it('caps example event uuids at three, taken from the payload', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      decision(i, 1000 + i, 'block', [LLM01])
    );

    const { stats } = computeControlStats(many);

    expect(stats?.[0]?.exampleEventUuids).toEqual(['evt-0', 'evt-1', 'evt-2']);
  });

  it('honours the window bounds', () => {
    const { stats, unmapped } = computeControlStats(events, {
      sinceUnix: 1200,
      untilUnix: 1400,
    });

    expect(stats?.map((stat) => stat.controlId)).toEqual(['LLM02']);
    expect(unmapped?.total).toBe(1);
  });

  it('returns zeroed unmapped and no stats for an empty window', () => {
    const result = computeControlStats(events, { sinceUnix: 5000 });

    expect(result.stats).toEqual([]);
    expect(result.unmapped?.total).toBe(0);
  });
});

describe('computeComplianceReport', () => {
  it('lists entries newest first with their controls', () => {
    const report = computeComplianceReport(events, {
      limit: 10,
      offset: 0,
      sinceUnix: 1000,
      untilUnix: 1300,
    });

    expect(report.total).toBe(3);
    expect(report.entries?.map((entry) => entry.eventUuid)).toEqual([
      'evt-3',
      'evt-2',
      'evt-1',
    ]);
    expect(report.entries?.[1]).toMatchObject({
      requestId: 'req-2',
      decision: 'allow',
      engine: 'filter',
      controls: [
        { framework: 'owasp_llm_top10', controlId: 'LLM01' },
        { framework: 'owasp_llm_top10', controlId: 'LLM02' },
      ],
    });
    expect(report.sinceUnix).toBe(1000);
    expect(report.untilUnix).toBe(1300);
  });

  it('pages by limit and offset while total stays the full count', () => {
    const second = computeComplianceReport(events, { limit: 2, offset: 2 });

    expect(second.total).toBe(5);
    expect(second.entries?.map((entry) => entry.eventUuid)).toEqual([
      'evt-3',
      'evt-2',
    ]);
  });
});

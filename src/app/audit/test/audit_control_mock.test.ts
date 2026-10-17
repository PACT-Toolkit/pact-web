import { describe, expect, it } from 'vitest';

import { db } from '@/mocks/data/dbFactory';
import { getAuditEvents } from '@/src/__codegen__/rest/audit';
import { enrichDecisionPayload } from '@/src/app/audit/mock/data/audit_decision_enrichment';
import { parseDecisionPayload } from '@/src/lib/decisions/decision_payload';

describe('GET /v1/audit/events mock - control filter', () => {
  it('answers 400 when only one of controlFramework / controlId is set', async () => {
    const onlyFramework = await getAuditEvents({
      topic: 'pact.decisions',
      controlFramework: 'owasp_llm_top10',
    });
    const onlyId = await getAuditEvents({
      topic: 'pact.decisions',
      controlId: 'LLM01',
    });

    expect(onlyFramework.status).toBe(400);
    expect(onlyId.status).toBe(400);
  });

  it('narrows pact.decisions to rows carrying the control', async () => {
    const all = await getAuditEvents({ topic: 'pact.decisions', limit: 200 });
    const narrowed = await getAuditEvents({
      topic: 'pact.decisions',
      limit: 200,
      controlFramework: 'owasp_llm_top10',
      controlId: 'LLM02',
    });

    if (all.status !== 200 || narrowed.status !== 200) {
      throw new Error('expected 200 responses');
    }
    expect(narrowed.data.total).toBeGreaterThan(0);
    expect(narrowed.data.total).toBeLessThan(all.data.total ?? 0);
    for (const event of narrowed.data.events ?? []) {
      const payload = parseDecisionPayload(event.payloadJson ?? '');
      expect(payload?.redactor?.controls).toContainEqual({
        framework: 'owasp_llm_top10',
        id: 'LLM02',
      });
    }
  });
});

describe('decision mock enrichment', () => {
  it('stamps stages, durations, controls and the rule pack on a filter block', () => {
    const out = enrichDecisionPayload({
      request_id: 'req-x',
      decision: 'block',
      engine: 'filter',
      filter: { verdict: 'hostile' },
    });

    expect(out.stages).toEqual(['policy', 'filter']);
    expect(out.filter?.pack_name).toBe('pact-core');
    expect(out.filter?.pack_version).toBe('1.4.0');
    expect(out.filter?.duration_ms).toBeGreaterThan(0);
    expect(out.filter?.controls).toContainEqual({
      framework: 'owasp_llm_top10',
      id: 'LLM01',
    });
  });

  it('lists all nine stages on an allow and omits stages on a gateway rejection', () => {
    expect(
      enrichDecisionPayload({ decision: 'allow', filter: { verdict: 'safe' } })
        .stages
    ).toHaveLength(9);
    expect(
      enrichDecisionPayload({ decision: 'block', engine: 'gateway' }).stages
    ).toBeUndefined();
  });

  it('enriches every seeded decision row that has a filter sub-object', () => {
    const withFilter = db.decisions
      .getAll()
      .map((row) => parseDecisionPayload(row.payloadJson ?? ''))
      .filter((payload) => payload?.filter !== undefined);

    expect(withFilter.length).toBeGreaterThan(0);
    for (const payload of withFilter) {
      expect(payload?.filter?.pack_name).toBe('pact-core');
      expect(payload?.stages?.length).toBeGreaterThan(0);
    }
  });
});

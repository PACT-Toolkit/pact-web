import { describe, expect, it } from 'vitest';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { extractRedactorRecords } from '@/src/app/redactor/domain/redactor_record';

const decisionEvent = (
  id: string,
  payload: Record<string, unknown>
): AuditEvent => ({
  id,
  topic: 'pact.decisions',
  eventId: 'decision.made',
  requestId: `req-${id}`,
  payloadJson: JSON.stringify(payload),
  createdAt: '2026-07-01T12:00:00Z',
});

describe('extractRedactorRecords', () => {
  it('includes an event whose payload has a redactor sub-object', () => {
    const events = [
      decisionEvent('evt-1', {
        decision: 'allow',
        engine: 'gateway-v1',
        redactor: {
          verdict: 'redacted',
          spans: [{ start: 10, end: 20, label: 'EMAIL' }],
        },
        latency_ms: 42,
      }),
    ];

    const records = extractRedactorRecords(events);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'evt-1',
      requestId: 'req-evt-1',
      engine: 'gateway-v1',
      latencyMs: 42,
    });
    expect(records[0].redactor.verdict).toBe('redacted');
    expect(records[0].redactor.spans).toHaveLength(1);
  });

  it('includes a pass_through event with no spans', () => {
    const events = [
      decisionEvent('evt-2', {
        decision: 'allow',
        redactor: { verdict: 'pass_through', spans: [] },
      }),
    ];

    const records = extractRedactorRecords(events);
    expect(records).toHaveLength(1);
    expect(records[0].redactor.verdict).toBe('pass_through');
    expect(records[0].redactor.spans).toHaveLength(0);
  });

  it('excludes an event whose payload has no redactor sub-object', () => {
    const events = [
      decisionEvent('evt-3', {
        decision: 'allow',
        classifier: { label: 'benign', score: 0.97 },
      }),
    ];

    expect(extractRedactorRecords(events)).toHaveLength(0);
  });

  it('excludes an event whose redactor field is explicitly null', () => {
    const events = [
      decisionEvent('evt-4', {
        decision: 'allow',
        redactor: null,
      }),
    ];

    expect(extractRedactorRecords(events)).toHaveLength(0);
  });

  it('never throws on malformed payload JSON and simply excludes the event', () => {
    const events: AuditEvent[] = [
      {
        id: 'evt-5',
        topic: 'pact.decisions',
        eventId: 'decision.made',
        requestId: 'req-evt-5',
        payloadJson: '{not-json',
        createdAt: '2026-07-01T12:00:01Z',
      },
    ];

    expect(() => extractRedactorRecords(events)).not.toThrow();
    expect(extractRedactorRecords(events)).toHaveLength(0);
  });

  it('is mixed correctly across a page with both kinds of events, order preserved', () => {
    const events = [
      decisionEvent('evt-6', {
        decision: 'allow',
        redactor: { verdict: 'pass_through', spans: [] },
      }),
      decisionEvent('evt-7', {
        decision: 'allow',
        classifier: { label: 'benign', score: 0.98 },
      }),
      decisionEvent('evt-8', {
        decision: 'block',
        redactor: {
          verdict: 'redacted',
          spans: [{ start: 0, end: 5, label: 'SSN' }],
        },
      }),
    ];

    const records = extractRedactorRecords(events);
    expect(records.map((r) => r.id)).toEqual(['evt-6', 'evt-8']);
  });

  it('tolerates a redactor sub-object with no spans field at all', () => {
    const events = [
      decisionEvent('evt-9', {
        decision: 'allow',
        redactor: { verdict: 'unknown' },
      }),
    ];

    const records = extractRedactorRecords(events);
    expect(records[0].redactor.spans).toBeUndefined();
    expect(records[0].engine).toBeUndefined();
    expect(records[0].latencyMs).toBeUndefined();
  });
});

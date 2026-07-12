import { describe, expect, it } from 'vitest';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { extractClassifierRecords } from '@/src/app/classifier/domain/classifier_record';

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

describe('extractClassifierRecords', () => {
  it('includes an event whose payload has a classifier sub-object', () => {
    const events = [
      decisionEvent('evt-1', {
        decision: 'allow',
        engine: 'gateway-v1',
        classifier: {
          label: 'benign',
          score: 0.97,
          engine: 'deberta-v3-pact-injection-v1',
        },
        latency_ms: 18,
      }),
    ];

    const records = extractClassifierRecords(events);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'evt-1',
      requestId: 'req-evt-1',
      decision: 'allow',
      latencyMs: 18,
      consensusArbitrated: false,
    });
    expect(records[0].classifier.label).toBe('benign');
    expect(records[0].classifier.score).toBe(0.97);
    expect(records[0].classifier.engine).toBe('deberta-v3-pact-injection-v1');
  });

  it('marks consensusArbitrated true when the payload also carries a consensus sub-object', () => {
    const events = [
      decisionEvent('evt-2', {
        decision: 'block',
        classifier: { label: 'jailbreak', score: 0.58 },
        consensus: { label: 'jailbreak', confidence: 0.93 },
      }),
    ];

    const records = extractClassifierRecords(events);
    expect(records).toHaveLength(1);
    expect(records[0].consensusArbitrated).toBe(true);
  });

  it('excludes an event whose payload has no classifier sub-object', () => {
    const events = [
      decisionEvent('evt-3', {
        decision: 'allow',
        redactor: { verdict: 'pass_through', spans: [] },
      }),
    ];

    expect(extractClassifierRecords(events)).toHaveLength(0);
  });

  it('excludes an event whose classifier field is explicitly null', () => {
    const events = [
      decisionEvent('evt-4', {
        decision: 'allow',
        classifier: null,
      }),
    ];

    expect(extractClassifierRecords(events)).toHaveLength(0);
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

    expect(() => extractClassifierRecords(events)).not.toThrow();
    expect(extractClassifierRecords(events)).toHaveLength(0);
  });

  it('is mixed correctly across a page with both kinds of events, order preserved', () => {
    const events = [
      decisionEvent('evt-6', {
        decision: 'allow',
        classifier: { label: 'benign', score: 0.98 },
      }),
      decisionEvent('evt-7', {
        decision: 'allow',
        redactor: { verdict: 'pass_through', spans: [] },
      }),
      decisionEvent('evt-8', {
        decision: 'block',
        classifier: { label: 'prompt_injection', score: 0.94 },
      }),
    ];

    const records = extractClassifierRecords(events);
    expect(records.map((r) => r.id)).toEqual(['evt-6', 'evt-8']);
  });

  it('tolerates a classifier sub-object with no score or engine field at all', () => {
    const events = [
      decisionEvent('evt-9', {
        decision: 'allow',
        classifier: { label: 'unknown' },
      }),
    ];

    const records = extractClassifierRecords(events);
    expect(records[0].classifier.score).toBeUndefined();
    expect(records[0].classifier.engine).toBeUndefined();
    expect(records[0].latencyMs).toBeUndefined();
    expect(records[0].consensusArbitrated).toBe(false);
  });
});

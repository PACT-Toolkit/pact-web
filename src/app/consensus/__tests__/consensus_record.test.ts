import { describe, expect, it } from 'vitest';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { extractConsensusRecords } from '@/src/app/consensus/domain/consensus_record';

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

describe('extractConsensusRecords', () => {
  it('includes an event whose payload has a consensus sub-object', () => {
    const events = [
      decisionEvent('evt-1', {
        decision: 'allow',
        engine: 'consensus',
        classifier: { label: 'suspicious', score: 0.5, engine: 'stub-v1' },
        consensus: {
          label: 'benign',
          confidence: 0.82,
          quorum_reached: true,
          backend_count: 2,
          votes: [
            { backend_id: 'b1', label: 'benign', score: 0.9 },
            { backend_id: 'b2', label: 'benign', score: 0.74 },
          ],
        },
        latency_ms: 88,
      }),
    ];

    const records = extractConsensusRecords(events);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: 'evt-1',
      requestId: 'req-evt-1',
      classifierEngine: 'stub-v1',
      latencyMs: 88,
    });
    expect(records[0].consensus.label).toBe('benign');
    expect(records[0].consensus.votes).toHaveLength(2);
  });

  it('excludes an event whose payload has no consensus sub-object', () => {
    const events = [
      decisionEvent('evt-2', {
        decision: 'allow',
        engine: 'classifier',
        classifier: { label: 'benign', score: 0.97 },
      }),
    ];

    expect(extractConsensusRecords(events)).toHaveLength(0);
  });

  it('excludes an event whose consensus field is explicitly null', () => {
    const events = [
      decisionEvent('evt-3', {
        decision: 'allow',
        consensus: null,
      }),
    ];

    expect(extractConsensusRecords(events)).toHaveLength(0);
  });

  it('never throws on malformed payload JSON and simply excludes the event', () => {
    const events: AuditEvent[] = [
      {
        id: 'evt-4',
        topic: 'pact.decisions',
        eventId: 'decision.made',
        requestId: 'req-evt-4',
        payloadJson: '{not-json',
        createdAt: '2026-07-01T12:00:01Z',
      },
    ];

    expect(() => extractConsensusRecords(events)).not.toThrow();
    expect(extractConsensusRecords(events)).toHaveLength(0);
  });

  it('is mixed correctly across a page with both kinds of events, newest-first order preserved', () => {
    const events = [
      decisionEvent('evt-5', {
        decision: 'allow',
        consensus: { label: 'benign', quorum_reached: true },
      }),
      decisionEvent('evt-6', {
        decision: 'allow',
        classifier: { label: 'benign', score: 0.98 },
      }),
      decisionEvent('evt-7', {
        decision: 'block',
        consensus: { skipped: true, quorum_reached: false },
      }),
    ];

    const records = extractConsensusRecords(events);
    expect(records.map((r) => r.id)).toEqual(['evt-5', 'evt-7']);
  });

  it('tolerates a consensus sub-object with no votes (fail-open case)', () => {
    const events = [
      decisionEvent('evt-8', {
        decision: 'allow',
        consensus: { skipped: true, quorum_reached: false },
      }),
    ];

    const records = extractConsensusRecords(events);
    expect(records[0].consensus.votes).toBeUndefined();
    expect(records[0].classifierEngine).toBeUndefined();
    expect(records[0].latencyMs).toBeUndefined();
  });
});

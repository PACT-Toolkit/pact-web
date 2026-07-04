import { describe, expect, it } from 'vitest';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  applyOptimisticFalsePositiveFlag,
  buildFilterFalsePositiveLabelRequest,
  isFlaggedFalsePositive,
  resolveFlagRequestId,
} from '@/src/app/filter/domain/filter_false_positive';

const event = (overrides: Partial<AuditEvent>): AuditEvent => ({
  id: 'evt-1',
  topic: 'pact.decisions',
  eventId: 'filter.decision',
  requestId: 'req-1',
  payloadJson: JSON.stringify({
    request_id: 'req-1',
    decision: 'block',
    filter_rule_id: 'inject-003',
    latency_ms: 4,
  }),
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('buildFilterFalsePositiveLabelRequest', () => {
  it('sends a non-empty placeholder content, an unknown predicted label, and a distinct source tag', () => {
    const request = buildFilterFalsePositiveLabelRequest('req-1', {
      request_id: 'req-1',
      decision: 'block',
      filter_rule_id: 'inject-003',
      latency_ms: 4,
    });

    expect(request.requestId).toBe('req-1');
    expect(request.content).toBeTruthy();
    expect(request.content).toContain('inject-003');
    expect(request.predictedLabel).toBe('unknown');
    expect(request.operatorLabel).toBe('false_positive');
    expect(request.source).toBe('filter_console_decision_flag');
  });

  it('still sends a non-empty content placeholder when the payload has no rule id or reason', () => {
    const request = buildFilterFalsePositiveLabelRequest('req-2', null);

    expect(request.content).toBeTruthy();
    expect(request.content).toContain('n/a');
  });
});

describe('resolveFlagRequestId', () => {
  it('prefers the audit row requestId over the payload copy', () => {
    const evt = event({ requestId: 'req-from-event' });
    expect(
      resolveFlagRequestId(evt, {
        request_id: 'req-from-payload',
        decision: 'block',
        latency_ms: 1,
      })
    ).toBe('req-from-event');
  });

  it('falls back to the payload request_id when the event has none', () => {
    const evt = event({ requestId: undefined });
    expect(
      resolveFlagRequestId(evt, {
        request_id: 'req-from-payload',
        decision: 'block',
        latency_ms: 1,
      })
    ).toBe('req-from-payload');
  });

  it('returns undefined when neither source has a request id', () => {
    const evt = event({ requestId: undefined });
    expect(resolveFlagRequestId(evt, null)).toBeUndefined();
  });
});

describe('isFlaggedFalsePositive', () => {
  it('is true only when is_false_positive is exactly true', () => {
    expect(
      isFlaggedFalsePositive({
        request_id: 'r',
        decision: 'block',
        latency_ms: 1,
        is_false_positive: true,
      })
    ).toBe(true);
    expect(
      isFlaggedFalsePositive({
        request_id: 'r',
        decision: 'block',
        latency_ms: 1,
      })
    ).toBe(false);
    expect(isFlaggedFalsePositive(null)).toBe(false);
  });
});

describe('applyOptimisticFalsePositiveFlag', () => {
  it('flips only the matching event and leaves others untouched', () => {
    const flagged = event({ id: 'evt-flag-me' });
    const other = event({ id: 'evt-other', requestId: 'req-other' });

    const current = {
      status: 200 as const,
      data: { events: [flagged, other], total: 2 },
      headers: new Headers(),
    };

    const updated = applyOptimisticFalsePositiveFlag(current, 'evt-flag-me');
    const events = updated?.status === 200 ? updated.data.events : [];
    const updatedFlagged = events.find((e) => e.id === 'evt-flag-me');
    const updatedOther = events.find((e) => e.id === 'evt-other');

    expect(updatedFlagged?.payloadJson).toContain('"is_false_positive":true');
    expect(updatedOther?.payloadJson).toBe(other.payloadJson);
  });

  it('passes through unchanged when there is no cached data yet', () => {
    expect(
      applyOptimisticFalsePositiveFlag(undefined, 'evt-1')
    ).toBeUndefined();
  });

  it('passes through unchanged on a non-200 cached response', () => {
    const current = {
      status: 401 as const,
      data: { error: 'missing or invalid session' },
      headers: new Headers(),
    };

    expect(applyOptimisticFalsePositiveFlag(current, 'evt-1')).toBe(current);
  });
});

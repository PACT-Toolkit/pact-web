import { describe, expect, it } from 'vitest';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  applyOptimisticAnnotationFlag,
  buildAnnotateDecisionRequest,
  buildDecisionAnnotationsQueryKey,
  buildFilterFalsePositiveLabelRequest,
  extractFlaggedFalsePositiveRequestIds,
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
    filter: { rule_id: 'inject-003' },
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
      filter: { rule_id: 'inject-003' },
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

describe('buildAnnotateDecisionRequest', () => {
  it('builds a false_positive annotation request for the given requestId', () => {
    expect(buildAnnotateDecisionRequest('req-1')).toEqual({
      requestId: 'req-1',
      kind: 'false_positive',
    });
  });
});

describe('buildDecisionAnnotationsQueryKey', () => {
  it('returns null when there are no request ids to look up', () => {
    expect(buildDecisionAnnotationsQueryKey([])).toBeNull();
  });

  it('returns a stable key including every request id when there is at least one', () => {
    expect(buildDecisionAnnotationsQueryKey(['req-1', 'req-2'])).toEqual([
      'filter-decision-annotations',
      'req-1',
      'req-2',
    ]);
  });
});

describe('extractFlaggedFalsePositiveRequestIds', () => {
  it('collects requestIds for false_positive annotations only', () => {
    const flagged = extractFlaggedFalsePositiveRequestIds({
      annotations: [
        {
          requestId: 'req-1',
          kind: 'false_positive',
          actor: 'user-1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });

    expect(flagged.has('req-1')).toBe(true);
    expect(flagged.size).toBe(1);
  });

  it('returns an empty set when data is undefined', () => {
    expect(extractFlaggedFalsePositiveRequestIds(undefined).size).toBe(0);
  });
});

describe('isFlaggedFalsePositive', () => {
  it('is true only when requestId is present in the flagged set', () => {
    const flagged = new Set(['req-1']);

    expect(isFlaggedFalsePositive(flagged, 'req-1')).toBe(true);
    expect(isFlaggedFalsePositive(flagged, 'req-2')).toBe(false);
    expect(isFlaggedFalsePositive(flagged, undefined)).toBe(false);
  });
});

describe('applyOptimisticAnnotationFlag', () => {
  it('appends a synthetic false_positive annotation for the given requestId', () => {
    const current = { annotations: [] };

    const updated = applyOptimisticAnnotationFlag(current, 'req-1');

    expect(updated?.annotations).toHaveLength(1);
    expect(updated?.annotations[0]?.requestId).toBe('req-1');
    expect(updated?.annotations[0]?.kind).toBe('false_positive');
  });

  it('does not duplicate an existing false_positive annotation for the same requestId', () => {
    const current = {
      annotations: [
        {
          requestId: 'req-1',
          kind: 'false_positive' as const,
          actor: 'user-1',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    };

    const updated = applyOptimisticAnnotationFlag(current, 'req-1');

    expect(updated).toBe(current);
  });

  it('builds a fresh single-entry response when there is no cached data yet', () => {
    const updated = applyOptimisticAnnotationFlag(undefined, 'req-1');

    expect(updated.annotations).toHaveLength(1);
    expect(updated.annotations[0]?.requestId).toBe('req-1');
  });
});

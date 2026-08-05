import { describe, expect, it } from 'vitest';

import { derivePipelineStages } from '@/src/app/audit/domain/audit_decision_stage_strip';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

describe('derivePipelineStages', () => {
  it('returns one entry per present stage sub-object, in pipeline order, with the engine stage marked blocked', () => {
    const payload: DecisionPayload = {
      decision: 'block',
      engine: 'consensus',
      classifier: { label: 'jailbreak', score: 0.58 },
      consensus: { label: 'jailbreak', confidence: 0.93, quorum_reached: true },
      latency_ms: 340,
    };

    expect(derivePipelineStages(payload)).toEqual([
      { id: 'classifier', blocked: false },
      { id: 'consensus', blocked: true },
    ]);
  });

  it('orders stages by true pipeline execution order regardless of payload key order', () => {
    const payload: DecisionPayload = {
      decision: 'block',
      engine: 'redactor',
      redactor: { verdict: 'redacted' },
      filter: { verdict: 'suspicious' },
      consensus: { label: 'safe', quorum_reached: true },
      latency_ms: 10,
    };

    expect(derivePipelineStages(payload).map((s) => s.id)).toEqual([
      'filter',
      'consensus',
      'redactor',
    ]);
  });

  it('marks no stage blocked when the payload is an allow decision, even with engine set', () => {
    const payload: DecisionPayload = {
      decision: 'allow',
      engine: 'consensus',
      classifier: { label: 'safe', score: 0.1 },
      consensus: { label: 'safe', quorum_reached: true },
      latency_ms: 12,
    };

    expect(derivePipelineStages(payload)).toEqual([
      { id: 'classifier', blocked: false },
      { id: 'consensus', blocked: false },
    ]);
  });

  it('returns an empty list when no stage sub-objects are present (older events)', () => {
    const payload: DecisionPayload = {
      decision: 'block',
      reason: 'filter_hostile',
      engine: 'filter',
      latency_ms: 4,
    };

    expect(derivePipelineStages(payload)).toEqual([]);
  });

  it('marks no stage blocked when engine names a virtual stage with no chip (e.g. policy)', () => {
    const payload: DecisionPayload = {
      decision: 'block',
      engine: 'policy',
      filter: { verdict: 'safe' },
      latency_ms: 6,
    };

    expect(derivePipelineStages(payload)).toEqual([
      { id: 'filter', blocked: false },
    ]);
  });

  it('includes sandbox only when external_refs is present, between classifier and consensus', () => {
    const payload: DecisionPayload = {
      decision: 'block',
      engine: 'sandbox',
      classifier: { label: 'safe', score: 0.1 },
      external_refs: { source: 'external_ref', scanned: 2, blocked: 1 },
      consensus: { label: 'safe', quorum_reached: true },
      latency_ms: 9,
    };

    expect(derivePipelineStages(payload).map((s) => s.id)).toEqual([
      'classifier',
      'sandbox',
      'consensus',
    ]);
  });
});

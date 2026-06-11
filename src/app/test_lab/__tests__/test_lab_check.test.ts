import { describe, expect, it } from 'vitest';

import {
  applyLiveLayers,
  BLANK_LAYERS,
  type CheckResponse,
} from '@/src/app/test_lab/domain/test_lab_check';

// Helper: pretend the user pressed "Run" — BLANK_LAYERS starts pending.
const startingLayers = () =>
  BLANK_LAYERS.map((l) => ({ ...l, decision: 'pending' as const }));

const baseResponse = (over: Partial<CheckResponse> = {}): CheckResponse => ({
  request_id: 'req-1',
  decision: 'allow',
  latency_ms: 12,
  ...over,
});

describe('applyLiveLayers — PACT-230 live-mode hardening', () => {
  it('benign input: both layers allow, no rule_id, no classifier metadata', () => {
    const out = applyLiveLayers(startingLayers(), baseResponse(), []);
    expect(out.map((l) => [l.id, l.decision])).toEqual([
      ['filter', 'allow'],
      ['classifier', 'allow'],
    ]);
    expect(out[0].ruleId).toBeUndefined();
    expect(out[1].classifierLabel).toBeUndefined();
    expect(out[1].confidence).toBeUndefined();
  });

  it('filter blocks via filter_rule_id (no reason string match required)', () => {
    // Structural signal only — reason field deliberately not 'filter_hostile'.
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({
        decision: 'block',
        reason: 'engine_regex_match',
        filter_rule_id: 'RULE-INJECT-001',
      }),
      []
    );
    expect(out[0].decision).toBe('block');
    expect(out[0].ruleId).toBe('RULE-INJECT-001');
    expect(out[0].reason).toContain('RULE-INJECT-001');
    expect(out[1].decision).toBe('skip');
    expect(out[1].reason).toMatch(/filter blocked/i);
  });

  it('filter blocks via legacy reason=filter_hostile when filter_rule_id is empty', () => {
    // Backwards-compatible: older gateway builds may not always populate
    // filter_rule_id; the legacy reason string still triggers the block.
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({ decision: 'block', reason: 'filter_hostile' }),
      []
    );
    expect(out[0].decision).toBe('block');
    expect(out[1].decision).toBe('skip');
  });

  it('classifier blocks: surfaces label + score (confidence) on the classifier layer', () => {
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({
        decision: 'block',
        reason: 'classifier_tagged',
        classifier: { label: 'jailbreak', score: 0.94 },
      }),
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[1].decision).toBe('block');
    expect(out[1].classifierLabel).toBe('jailbreak');
    expect(out[1].confidence).toBe(0.94);
  });

  it('classifier tags but decision is allow (shadow): classifier=allow with label', () => {
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({
        decision: 'allow',
        reason: 'classifier_tagged',
        classifier: { label: 'suspicious', score: 0.55 },
      }),
      []
    );
    expect(out[1].decision).toBe('allow');
    expect(out[1].classifierLabel).toBe('suspicious');
    expect(out[1].confidence).toBe(0.55);
  });

  it('classifier unreachable (fail-open): classifier=skip with fail-open note', () => {
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({ reason: 'classifier_unreachable' }),
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[1].decision).toBe('skip');
    expect(out[1].reason).toMatch(/fail open/i);
  });

  it('downstream block (e.g. policy_token_denied) does NOT attribute the block to the classifier', () => {
    // Gateway returns decision=block but the classifier produced no label,
    // so the block came from a downstream stage we don't visualise.
    // Classifier layer reads "allow" — it didn't gate.
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({ decision: 'block', reason: 'policy_token_denied' }),
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[1].decision).toBe('allow');
    expect(out[1].classifierLabel).toBeUndefined();
  });

  it('respects bypassLayers — bypassed layer is left untouched', () => {
    const prev = startingLayers().map((l) =>
      l.id === 'filter'
        ? { ...l, bypassed: true, decision: 'skip' as const }
        : l
    );
    const out = applyLiveLayers(
      prev,
      baseResponse({
        decision: 'block',
        reason: 'classifier_tagged',
        classifier: { label: 'jailbreak', score: 0.9 },
      }),
      ['filter']
    );
    expect(out[0].bypassed).toBe(true);
    expect(out[0].decision).toBe('skip');
    expect(out[1].decision).toBe('block');
    expect(out[1].classifierLabel).toBe('jailbreak');
  });

  it('does not crash when the response contains an unknown reason code', () => {
    // Forward-compatibility: pact-gateway may add new reason values that
    // pact-web hasn't been updated for. The structural inference path
    // means the layers still resolve sensibly.
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({ decision: 'allow', reason: 'some_future_reason' }),
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[1].decision).toBe('allow');
  });
});

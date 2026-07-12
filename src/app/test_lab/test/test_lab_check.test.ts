import { describe, expect, it } from 'vitest';

import {
  applyLiveLayers,
  applyMockLayers,
  BLANK_LAYERS,
  type CheckResponse,
  CheckResponseParseError,
  type MockLayer,
  parseCheckResponse,
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

describe('applyLiveLayers — PACT-252 structural /v1/check fields', () => {
  it('filter.verdict=hostile blocks without filter_rule_id or reason string match', () => {
    // Pure structural path: the gateway only emits the filter sub-object,
    // no top-level filter_rule_id, and a reason value web has never seen.
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({
        decision: 'block',
        reason: 'some_future_filter_code',
        filter: { verdict: 'hostile', rule_id: 'STRUCTURAL-001' },
      }),
      []
    );
    expect(out[0].decision).toBe('block');
    expect(out[0].ruleId).toBe('STRUCTURAL-001');
    expect(out[0].reason).toContain('STRUCTURAL-001');
    expect(out[1].decision).toBe('skip');
    expect(out[1].reason).toMatch(/filter blocked/i);
  });

  it('filter.shadow=true: hostile verdict but decision=allow → filter layer = allow with shadow note', () => {
    // PACT-249's shadow mode: the rule fired but the gateway did NOT
    // enforce. The filter layer must NOT report block — it should surface
    // the shadow match in the reason text so reviewers can see the dry-run
    // rule that matched.
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({
        decision: 'allow',
        filter: { verdict: 'hostile', rule_id: 'SHADOW-007', shadow: true },
      }),
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[0].ruleId).toBe('SHADOW-007');
    expect(out[0].reason).toMatch(/shadow/i);
    expect(out[0].reason).toContain('SHADOW-007');
    expect(out[1].decision).toBe('allow');
  });

  it('filter.verdict=suspicious does not block (only hostile gates)', () => {
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({
        decision: 'allow',
        filter: { verdict: 'suspicious' },
      }),
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[0].reason).toBeUndefined();
    expect(out[1].decision).toBe('allow');
  });

  it('structural filter sub-object is authoritative — verdict=safe overrides legacy filter_rule_id', () => {
    // If pact-gateway started populating both surfaces during a migration
    // and the structural verdict says safe, web must trust the structural
    // signal even if filter_rule_id is set (e.g. a shadow rule that didn't
    // promote to hostile).
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({
        decision: 'allow',
        filter_rule_id: 'LEGACY-NOISE',
        filter: { verdict: 'safe' },
      }),
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[1].decision).toBe('allow');
  });

  it('forward-compat: redactor sub-object on the response does not affect layer resolution', () => {
    // The Test Lab does not visualise a redactor layer today, but pact-gateway
    // emits redactor.{verdict, spans} on the /v1/check response. The presence
    // of those fields must not perturb filter/classifier inference.
    const out = applyLiveLayers(
      startingLayers(),
      baseResponse({
        decision: 'allow',
        redactor: {
          verdict: 'redacted',
          spans: [{ start: 12, end: 28, label: 'EMAIL' }],
        },
      }),
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[1].decision).toBe('allow');
  });
});

describe('applyMockLayers - PACT-580 matches by MockLayer.name, not array position', () => {
  const mockLayer = (
    over: Partial<MockLayer> & Pick<MockLayer, 'name' | 'decision'>
  ): MockLayer => ({
    ...over,
  });

  it('matches each mock layer to its pipeline stage by name in the normal (in-order) case', () => {
    const out = applyMockLayers(
      startingLayers(),
      [
        mockLayer({
          name: 'filter',
          decision: 'allow',
          reason: 'No rule match',
        }),
        mockLayer({
          name: 'classifier',
          decision: 'block',
          label: 'jailbreak',
        }),
      ],
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[0].reason).toBe('No rule match');
    expect(out[1].decision).toBe('block');
    expect(out[1].classifierLabel).toBe('jailbreak');
  });

  it('still matches correctly when the mock payload lists layers out of order', () => {
    const out = applyMockLayers(
      startingLayers(),
      [
        mockLayer({
          name: 'classifier',
          decision: 'block',
          label: 'jailbreak',
        }),
        mockLayer({
          name: 'filter',
          decision: 'allow',
          reason: 'No rule match',
        }),
      ],
      []
    );
    expect(out[0].id).toBe('filter');
    expect(out[0].decision).toBe('allow');
    expect(out[0].reason).toBe('No rule match');
    expect(out[1].id).toBe('classifier');
    expect(out[1].decision).toBe('block');
    expect(out[1].classifierLabel).toBe('jailbreak');
  });

  it('marks a stage skip when the mock payload omits that stage entirely', () => {
    const out = applyMockLayers(
      startingLayers(),
      [mockLayer({ name: 'filter', decision: 'allow' })],
      []
    );
    expect(out[0].decision).toBe('allow');
    expect(out[1].decision).toBe('skip');
  });

  it('leaves a bypassed layer untouched even if a mock entry with its name is present', () => {
    const prev = startingLayers().map((l) =>
      l.id === 'filter'
        ? { ...l, bypassed: true, decision: 'skip' as const }
        : l
    );
    const out = applyMockLayers(
      prev,
      [
        mockLayer({ name: 'filter', decision: 'allow' }),
        mockLayer({ name: 'classifier', decision: 'allow' }),
      ],
      ['filter']
    );
    expect(out[0].bypassed).toBe(true);
    expect(out[0].decision).toBe('skip');
    expect(out[1].decision).toBe('allow');
  });
});

describe("parseCheckResponse — PACT-576 parse-don't-cast against the regenerated literal-union contract", () => {
  const validResponse = (): Record<string, unknown> => ({
    request_id: 'req-1',
    decision: 'allow',
    latency_ms: 12,
  });

  it('accepts a minimal valid response (only the required wire fields)', () => {
    const parsed = parseCheckResponse(validResponse());
    expect(parsed.decision).toBe('allow');
    expect(parsed.request_id).toBe('req-1');
    expect(parsed.latency_ms).toBe(12);
  });

  it('accepts a full response exercising every closed-set field the generated contract covers', () => {
    const raw = {
      ...validResponse(),
      decision: 'block',
      filter: { verdict: 'hostile', rule_id: 'RULE-1' },
      redactor: {
        verdict: 'redacted',
        spans: [{ start: 0, end: 3, label: 'X' }],
      },
      classifier: { label: 'jailbreak', score: 0.9 },
      external_refs: {
        refs: [
          { source: 'a', verdict: 'mitigated' },
          { source: 'b', verdict: 'clean' },
        ],
      },
      spotlight: {
        format: 'xml',
        chunks: [{ source: 'rag:doc#1', trust: 'untrusted', wrapped: '<x/>' }],
      },
    };
    const parsed = parseCheckResponse(raw);
    expect(parsed.decision).toBe('block');
    expect(parsed.filter?.verdict).toBe('hostile');
    expect(parsed.redactor?.verdict).toBe('redacted');
    expect(parsed.external_refs?.refs?.[0].verdict).toBe('mitigated');
    expect(parsed.spotlight?.format).toBe('xml');
    expect(parsed.spotlight?.chunks?.[0].trust).toBe('untrusted');
  });

  it('leaves classifier.label unvalidated (open by design — no closed set on the wire)', () => {
    const parsed = parseCheckResponse({
      ...validResponse(),
      classifier: { label: 'some-future-label-the-model-adds' },
    });
    expect(parsed.classifier?.label).toBe('some-future-label-the-model-adds');
  });

  it('rejects a non-object payload', () => {
    expect(() => parseCheckResponse(null)).toThrow(CheckResponseParseError);
    expect(() => parseCheckResponse('allow')).toThrow(CheckResponseParseError);
    expect(() => parseCheckResponse([1, 2, 3])).toThrow(
      CheckResponseParseError
    );
  });

  it('rejects a decision outside the allow|block closed set', () => {
    expect(() =>
      parseCheckResponse({ ...validResponse(), decision: 'maybe' })
    ).toThrow(CheckResponseParseError);
  });

  it('rejects a missing decision', () => {
    const raw = validResponse();
    delete raw.decision;
    expect(() => parseCheckResponse(raw)).toThrow(/decision/);
  });

  it('rejects a filter.verdict outside the safe|suspicious|hostile|unknown closed set', () => {
    expect(() =>
      parseCheckResponse({
        ...validResponse(),
        filter: { verdict: 'definitely-hostile' },
      })
    ).toThrow(/filter\.verdict/);
  });

  it('rejects a redactor.verdict outside the pass_through|redacted|unknown closed set', () => {
    expect(() =>
      parseCheckResponse({
        ...validResponse(),
        redactor: { verdict: 'scrubbed' },
      })
    ).toThrow(/redactor\.verdict/);
  });

  it('rejects an external_refs.refs[].verdict outside its closed set', () => {
    expect(() =>
      parseCheckResponse({
        ...validResponse(),
        external_refs: { refs: [{ source: 'a', verdict: 'suspicious' }] },
      })
    ).toThrow(/external_refs\.refs\[0\]\.verdict/);
  });

  it('rejects a spotlight.format outside the delim|xml|json closed set', () => {
    expect(() =>
      parseCheckResponse({
        ...validResponse(),
        spotlight: { format: 'yaml' },
      })
    ).toThrow(/spotlight\.format/);
  });

  it('rejects a spotlight.chunks[].trust outside the trusted|user|untrusted closed set', () => {
    expect(() =>
      parseCheckResponse({
        ...validResponse(),
        spotlight: { chunks: [{ source: 'x', trust: 'unknown' }] },
      })
    ).toThrow(/spotlight\.chunks\[0\]\.trust/);
  });

  it('rejects a missing required field (latency_ms)', () => {
    const raw = validResponse();
    delete raw.latency_ms;
    expect(() => parseCheckResponse(raw)).toThrow(/latency_ms/);
  });

  it('rejects a missing required field (request_id)', () => {
    const raw = validResponse();
    delete raw.request_id;
    expect(() => parseCheckResponse(raw)).toThrow(/request_id/);
  });

  it('rejects a non-object filter sub-object', () => {
    expect(() =>
      parseCheckResponse({ ...validResponse(), filter: 'hostile' })
    ).toThrow(/filter/);
  });

  it('rejects a non-array external_refs.refs', () => {
    expect(() =>
      parseCheckResponse({
        ...validResponse(),
        external_refs: { refs: 'not-an-array' },
      })
    ).toThrow(/external_refs\.refs/);
  });

  it('tolerates undefined optional sub-objects — only decision/latency_ms/request_id are required', () => {
    // filter/redactor/classifier/external_refs/spotlight are all optional on
    // the wire (a fast filter-only block never runs the classifier stage).
    expect(() => parseCheckResponse(validResponse())).not.toThrow();
  });
});

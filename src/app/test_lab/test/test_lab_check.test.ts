import { describe, expect, it } from 'vitest';

import {
  applyLiveLayers,
  BLANK_LAYERS,
  type CheckResponse,
  CheckResponseParseError,
  deriveLayerDefinitions,
  parseCheckResponse,
  type TestLabRunRecord,
  toTestRun,
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

// byId indexes applyLiveLayers' output by stage id so a test can assert on
// one stage without depending on array position -- important once sandbox's
// position shifts consensus/redactor depending on whether it renders.
const byId = (layers: ReturnType<typeof applyLiveLayers>) =>
  Object.fromEntries(layers.map((l) => [l.id, l]));

describe('applyLiveLayers - PACT-702 reason-driven block attribution', () => {
  it('benign input: every stage allows, no rule_id, no classifier/redactor/consensus metadata leaks through', () => {
    const out = byId(applyLiveLayers(startingLayers(), baseResponse(), []));
    expect(out.filter.decision).toBe('allow');
    expect(out.classifier.decision).toBe('allow');
    expect(out.filter.ruleId).toBeUndefined();
    expect(out.classifier.classifierLabel).toBeUndefined();
    expect(out.classifier.confidence).toBeUndefined();
    // Neither consensus nor redactor sub-object is present on this minimal
    // fixture -- both stay honestly "skip", never a fabricated allow.
    expect(out.consensus.decision).toBe('skip');
    expect(out.redactor.decision).toBe('skip');
  });

  it('benign input with full sub-objects: consensus skips (never escalated), redactor passes through', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          classifier: { label: 'benign', score: 0.95 },
          redactor: { verdict: 'pass_through', spans: [] },
        }),
        []
      )
    );
    expect(out.filter.decision).toBe('allow');
    expect(out.classifier.decision).toBe('allow');
    expect(out.consensus.decision).toBe('skip');
    expect(out.consensus.reason).toMatch(
      /confidence above threshold|not configured/i
    );
    expect(out.redactor.decision).toBe('allow');
    expect(out.redactor.reason).toBeUndefined();
  });

  it('filter_hostile blocks the filter layer only; classifier/consensus/redactor all skip', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'block',
          reason: 'filter_hostile',
          filter: { verdict: 'hostile', rule_id: 'inject-001' },
        }),
        []
      )
    );
    expect(out.filter.decision).toBe('block');
    expect(out.filter.ruleId).toBe('inject-001');
    expect(out.filter.reason).toContain('inject-001');
    expect(out.classifier.decision).toBe('skip');
    expect(out.classifier.reason).toMatch(/filter blocked/i);
    expect(out.consensus.decision).toBe('skip');
    expect(out.redactor.decision).toBe('skip');
  });

  it('filter_suspicious_enforced blocks the filter layer with enforcement-nuance wording, rule id shown', () => {
    // The user-reported PACT-702 bug: a suspicious verdict promoted to a
    // block by vector enforcement must land on the FILTER chip, not read as
    // an allow with the block unattributed anywhere.
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'block',
          reason: 'filter_suspicious_enforced',
          filter: { verdict: 'suspicious', rule_id: 'entropy-high-token' },
        }),
        []
      )
    );
    expect(out.filter.decision).toBe('block');
    expect(out.filter.ruleId).toBe('entropy-high-token');
    expect(out.filter.reason).toMatch(/enforced under vector mode/i);
    expect(out.filter.reason).toContain('entropy-high-token');
    expect(out.classifier.decision).toBe('skip');
  });

  it('filter blocks via legacy filter_rule_id when the structural sub-object is entirely absent', () => {
    // Back-compat for gateway builds older than PACT-249: no `filter`
    // sub-object at all, an arbitrary internal reason string, but
    // filter_rule_id + decision=block is still authoritative.
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'block',
          reason: 'engine_regex_match',
          filter_rule_id: 'RULE-INJECT-001',
        }),
        []
      )
    );
    expect(out.filter.decision).toBe('block');
    expect(out.filter.ruleId).toBe('RULE-INJECT-001');
    expect(out.filter.reason).toContain('RULE-INJECT-001');
    expect(out.classifier.decision).toBe('skip');
  });

  it('classifier_enforced blocks the classifier layer only; filter reads its own real allow', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'block',
          reason: 'classifier_enforced',
          classifier: { label: 'jailbreak', score: 0.94 },
        }),
        []
      )
    );
    expect(out.filter.decision).toBe('allow');
    expect(out.classifier.decision).toBe('block');
    expect(out.classifier.classifierLabel).toBe('jailbreak');
    expect(out.classifier.confidence).toBe(0.94);
    expect(out.consensus.decision).toBe('skip');
    expect(out.consensus.reason).toMatch(/classifier blocked/i);
    expect(out.redactor.decision).toBe('skip');
  });

  it('classifier_protocol_error blocks the classifier layer (fail-closed, corrects the spec prose against stages.go)', () => {
    // pact-gateway's classifierStage `default:` branch sets VerdictBlock for
    // an unrecognised label ("fail closed so a silent classifier regression
    // cannot wave bad traffic through") -- classifier_protocol_error is a
    // real block reason, even though the task spec's prose listed it among
    // non-block diagnostics. Trusting stages.go (the spec's own cited
    // authority) over that one line of prose.
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'block',
          reason: 'classifier_protocol_error',
        }),
        []
      )
    );
    expect(out.classifier.decision).toBe('block');
    expect(out.classifier.reason).toMatch(/unrecognised label/i);
    expect(out.consensus.decision).toBe('skip');
  });

  it('classifier_tagged (shadow / deferred): classifier=allow with label, nothing downstream force-skipped', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'allow',
          reason: 'classifier_tagged',
          classifier: { label: 'suspicious', score: 0.55 },
        }),
        []
      )
    );
    expect(out.classifier.decision).toBe('allow');
    expect(out.classifier.classifierLabel).toBe('suspicious');
    expect(out.classifier.confidence).toBe(0.55);
    expect(out.classifier.reason).toMatch(/deferred to consensus/i);
  });

  it('classifier_unreachable (fail-open halt): classifier=allow with fail-open note; sandbox/consensus/redactor force-skip', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({ reason: 'classifier_unreachable' }),
        []
      )
    );
    expect(out.filter.decision).toBe('allow');
    expect(out.classifier.decision).toBe('allow');
    expect(out.classifier.reason).toMatch(/fail open/i);
    expect(out.consensus.decision).toBe('skip');
    expect(out.consensus.reason).toMatch(/pipeline halted/i);
    expect(out.redactor.decision).toBe('skip');
  });

  it('consensus_enforced blocks the consensus layer; classifier stays allow with its own tag (the headline attribution bug)', () => {
    // This is exactly the PACT-702 bug: a downstream block (here consensus)
    // must not paint the classifier chip BLOCK just because the classifier
    // responded with a label.
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'block',
          reason: 'consensus_enforced',
          classifier: { label: 'sensitive', score: 0.42 },
          consensus: { duration_ms: 45 },
        }),
        []
      )
    );
    expect(out.classifier.decision).toBe('allow');
    expect(out.classifier.classifierLabel).toBe('sensitive');
    expect(out.consensus.decision).toBe('block');
    expect(out.consensus.reason).toMatch(/consensus vote confirmed/i);
    expect(out.redactor.decision).toBe('skip');
    expect(out.redactor.reason).toMatch(/consensus blocked/i);
  });

  it('policy_token_denied: every visualised stage skips -- nothing ran', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({ decision: 'block', reason: 'policy_token_denied' }),
        []
      )
    );
    expect(out.filter.decision).toBe('skip');
    expect(out.classifier.decision).toBe('skip');
    expect(out.consensus.decision).toBe('skip');
    expect(out.redactor.decision).toBe('skip');
    expect(out.filter.reason).toMatch(/before the pipeline ran/i);
  });

  it('cel_rule_fired: unattributed block -- every stage renders its own natural (allow) state, none show block', () => {
    // The CEL stage runs last, after every visualised stage, and is not
    // itself visualised. A block here must not be force-attributed to any
    // chip -- the Result node alone carries the block.
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'block',
          reason: 'cel_rule_fired',
          classifier: { label: 'benign', score: 0.97 },
          redactor: { verdict: 'pass_through', spans: [] },
        }),
        []
      )
    );
    expect(out.filter.decision).toBe('allow');
    expect(out.classifier.decision).toBe('allow');
    expect(out.consensus.decision).toBe('skip');
    expect(out.redactor.decision).toBe('allow');
  });

  it('policy_tool_mitigation: observe/redact override neutralised the block -- filter reads allow despite a hostile verdict', () => {
    // Observe/redact mode suppresses filterStage's own block branch
    // (`&& !sc.observeOrRedact`), so a hostile verdict can co-exist with an
    // overall allow decision. The pre-PACT-702 heuristic
    // (`verdict === 'hostile' && !shadow => block`) would have painted this
    // chip BLOCK; the reason-driven fix must not.
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'allow',
          reason: 'policy_tool_mitigation',
          filter: { verdict: 'hostile', rule_id: 'inject-002', shadow: false },
        }),
        []
      )
    );
    expect(out.filter.decision).toBe('allow');
    expect(out.filter.reason).toMatch(/not enforced/i);
  });

  it('filter.shadow=true: hostile verdict but decision=allow -> filter layer = allow with shadow note', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'allow',
          filter: { verdict: 'hostile', rule_id: 'SHADOW-007', shadow: true },
        }),
        []
      )
    );
    expect(out.filter.decision).toBe('allow');
    expect(out.filter.ruleId).toBe('SHADOW-007');
    expect(out.filter.reason).toMatch(/shadow/i);
    expect(out.filter.reason).toContain('SHADOW-007');
  });

  it('does not crash on an unmapped future reason code -- every stage resolves to its own natural state', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({ decision: 'allow', reason: 'some_future_reason' }),
        []
      )
    );
    expect(out.filter.decision).toBe('allow');
    expect(out.classifier.decision).toBe('allow');
  });

  it('respects bypassLayers - a bypassed layer is left untouched', () => {
    const prev = startingLayers().map((l) =>
      l.id === 'filter'
        ? { ...l, bypassed: true, decision: 'skip' as const }
        : l
    );
    const out = byId(
      applyLiveLayers(
        prev,
        baseResponse({
          decision: 'block',
          reason: 'classifier_enforced',
          classifier: { label: 'jailbreak', score: 0.9 },
        }),
        ['filter']
      )
    );
    expect(out.filter.bypassed).toBe(true);
    expect(out.filter.decision).toBe('skip');
    expect(out.classifier.decision).toBe('block');
    expect(out.classifier.classifierLabel).toBe('jailbreak');
  });
});

describe('applyLiveLayers - PACT-703 consensus/redactor/sandbox layer states', () => {
  it('external_refs present: sandbox is spliced in between classifier and consensus, in true execution order', () => {
    const defs = deriveLayerDefinitions(
      baseResponse({ external_refs: { scanned: 1, blocked: 0, mitigated: 0 } })
    );
    expect(defs.map((d) => d.id)).toEqual([
      'filter',
      'classifier',
      'sandbox',
      'consensus',
      'redactor',
    ]);
  });

  it('external_refs absent: sandbox does not render at all', () => {
    const defs = deriveLayerDefinitions(baseResponse());
    expect(defs.map((d) => d.id)).toEqual([
      'filter',
      'classifier',
      'consensus',
      'redactor',
    ]);
  });

  it('external_ref_hostile blocks the sandbox layer; consensus/redactor after it skip, classifier stays allow', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          decision: 'block',
          reason: 'external_ref_hostile',
          classifier: { label: 'benign', score: 0.9 },
          external_refs: { scanned: 2, blocked: 1, mitigated: 0 },
        }),
        []
      )
    );
    expect(out.classifier.decision).toBe('allow');
    expect(out.sandbox.decision).toBe('block');
    expect(out.sandbox.refsScanned).toBe(2);
    expect(out.sandbox.refsBlocked).toBe(1);
    expect(out.consensus.decision).toBe('skip');
    expect(out.consensus.reason).toMatch(/sandbox blocked/i);
    expect(out.redactor.decision).toBe('skip');
  });

  it('sandbox allows (refs scanned, none hostile) when no reason blocks it', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          external_refs: { scanned: 3, blocked: 0, mitigated: 1 },
        }),
        []
      )
    );
    expect(out.sandbox.decision).toBe('allow');
    expect(out.sandbox.refsScanned).toBe(3);
    expect(out.sandbox.refsMitigated).toBe(1);
  });

  it('consensus skip reason distinguishes classifier_unknown from an ordinary above-threshold/unconfigured skip', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({ reason: 'classifier_unknown' }),
        []
      )
    );
    expect(out.consensus.decision).toBe('skip');
    expect(out.consensus.reason).toMatch(/classifier declined to score/i);
  });

  it('redactor.verdict=redacted surfaces span count and labels; never reads as a block', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          redactor: {
            verdict: 'redacted',
            spans: [
              { start: 0, end: 10, label: 'EMAIL' },
              { start: 20, end: 30, label: 'PHONE' },
            ],
          },
        }),
        []
      )
    );
    expect(out.redactor.decision).toBe('allow');
    expect(out.redactor.redactedSpanCount).toBe(2);
    expect(out.redactor.redactedSpanLabels).toEqual(['EMAIL', 'PHONE']);
    expect(out.redactor.reason).toMatch(/redacted 2 span/i);
  });

  it('redactor.verdict=unknown (fail-open): allow, with a fail-open note, content unmodified', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({ redactor: { verdict: 'unknown', spans: [] } }),
        []
      )
    );
    expect(out.redactor.decision).toBe('allow');
    expect(out.redactor.reason).toMatch(/fail open/i);
  });

  it('duration_ms fields round to whole milliseconds for display', () => {
    const out = byId(
      applyLiveLayers(
        startingLayers(),
        baseResponse({
          filter: { verdict: 'safe', duration_ms: 3.482 },
          classifier: { label: 'benign', score: 0.9, duration_ms: 14.9 },
        }),
        []
      )
    );
    expect(out.filter.latencyMs).toBe(3);
    expect(out.classifier.latencyMs).toBe(15);
  });
});

describe("parseCheckResponse - PACT-576 parse-don't-cast against the regenerated literal-union contract", () => {
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

  it('leaves classifier.label unvalidated (open by design - no closed set on the wire)', () => {
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

  it('rejects a non-object consensus sub-object', () => {
    expect(() =>
      parseCheckResponse({ ...validResponse(), consensus: 'ran' })
    ).toThrow(/consensus/);
  });

  it('accepts a consensus sub-object (duration_ms only -- PACT-623 has no closed-set field on it yet)', () => {
    const parsed = parseCheckResponse({
      ...validResponse(),
      consensus: { duration_ms: 42 },
    });
    expect(parsed.consensus?.duration_ms).toBe(42);
  });

  it('rejects a non-array external_refs.refs', () => {
    expect(() =>
      parseCheckResponse({
        ...validResponse(),
        external_refs: { refs: 'not-an-array' },
      })
    ).toThrow(/external_refs\.refs/);
  });

  it('tolerates undefined optional sub-objects - only decision/latency_ms/request_id are required', () => {
    // filter/redactor/classifier/external_refs/spotlight are all optional on
    // the wire (a fast filter-only block never runs the classifier stage).
    expect(() => parseCheckResponse(validResponse())).not.toThrow();
  });
});

describe('toTestRun - PACT-595 persisted failed runs', () => {
  const baseRecord = (
    over: Partial<TestLabRunRecord> = {}
  ): TestLabRunRecord => ({
    id: 'run-1',
    content: 'hello world',
    attack_type: 'benign',
    decision: 'allow',
    reason: '',
    filter_rule_id: '',
    latency_ms: 42,
    request_id: 'req-1',
    created_at: 1000,
    ...over,
  });

  it('maps an ok/allow row to status=ok with the allow decision', () => {
    const run = toTestRun(baseRecord({ decision: 'allow' }));
    expect(run.status).toBe('ok');
    if (run.status !== 'ok') throw new Error('expected status=ok');
    expect(run.decision).toBe('allow');
  });

  it('maps an ok/block row to status=ok with the block decision and reason/rule', () => {
    const run = toTestRun(
      baseRecord({
        decision: 'block',
        reason: 'filter_hostile',
        filter_rule_id: 'role-005',
      })
    );
    expect(run.status).toBe('ok');
    if (run.status !== 'ok') throw new Error('expected status=ok');
    expect(run.decision).toBe('block');
    expect(run.reason).toBe('filter_hostile');
    expect(run.filterRuleId).toBe('role-005');
  });

  it('maps a status=error row to status=error and surfaces the error summary, without a decision', () => {
    const run = toTestRun(
      baseRecord({
        status: 'error',
        decision: '',
        error: 'check failed (503)',
      })
    );
    expect(run.status).toBe('error');
    expect('decision' in run).toBe(false);
    if (run.status === 'error') {
      expect(run.error).toBe('check failed (503)');
    }
  });

  it('does not cast an empty decision string into the allow|block closed set for a status=error row', () => {
    const run = toTestRun(
      baseRecord({ status: 'error', decision: '', error: 'timeout' })
    );
    expect(run.status).toBe('error');
    // TestRun's 'error' branch has no `decision` property at all -- this
    // guards against a regression that widens the type back to a plain
    // optional field defaulting to an invalid cast.
    expect((run as { decision?: unknown }).decision).toBeUndefined();
  });

  it('treats an undefined status as ok (back-compat for rows written before failed-run support)', () => {
    const run = toTestRun(baseRecord({ status: undefined, decision: 'block' }));
    expect(run.status).toBe('ok');
    if (run.status !== 'ok') throw new Error('expected status=ok');
    expect(run.decision).toBe('block');
  });

  it('falls back to status=error when status is ok/unset but decision is missing (defensive, should not happen on real data)', () => {
    const run = toTestRun(baseRecord({ status: undefined, decision: '' }));
    expect(run.status).toBe('error');
  });
});

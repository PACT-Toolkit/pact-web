import {
  type BenchmarkSaveCorpusRequest,
  type BenchmarkSaveTestLabRunRequest,
  type BenchmarkTestLabRunBody,
} from '@/src/__codegen__/rest/benchmark';
import {
  type CheckCheckRequest,
  type CheckCheckResponse,
  CheckCheckResponseDecision,
  CheckExternalRefInfoVerdict,
  CheckFilterInfoVerdict,
  CheckRedactorInfoVerdict,
  CheckSpotlightInfoFormat,
  CheckWrappedChunkTrust,
} from '@/src/__codegen__/rest/check';
import {
  type AttackChip,
  type LayerDecision,
  type LayerState,
} from '@/src/app/test_lab/ui/types';

// ─── API payload types ────────────────────────────────────────────────────────

// The /v1/check wire types are generated from the gateway's per-tag swagger
// slice (schema/check, pulled from pact-gateway). Alias the codegen names to
// the domain vocabulary the Test Lab UI uses.
//
// pact-gateway PR #134 (master b97e7e4) added swaggo `enums:` tags to the
// closed-set fields of check.CheckResponse, so orval now emits `decision` as
// the literal union CheckCheckResponseDecision ('allow' | 'block') instead of
// a plain string -- CheckResponse no longer needs to hand-refine it the way
// it did pre-PACT-576.
//
// PACT-702 removed the mock-only `_mock_layers` escape hatch: dev:mock now
// returns a faithful CheckResponse (canonical `reason`, `filter`/`classifier`/
// `consensus`/`redactor`/`external_refs` sub-objects) and layer inference
// (applyLiveLayers below) runs identically against mock and live responses.
// This is what makes dev:mock actually exercise the attribution logic this
// file implements, rather than a hand-authored per-stage array that could
// silently drift from it.
export type CheckResponse = CheckCheckResponse;

// CheckInput is the /v1/check request body plus the mock-only `_bypass_layers`
// hint that lets the Test Lab re-run with a stage skipped (dev:mock reads it;
// the real gateway ignores unknown fields).
export type CheckInput = CheckCheckRequest & { _bypass_layers?: string[] };

// ─── response parsing (PACT-576) ───────────────────────────────────────────────
//
// parse-don't-cast, mirroring parseDecisionPayload in
// src/lib/decisions/decision_payload.ts: validate the wire shape
// instead of trusting an unchecked `as CheckResponse` cast on the parsed JSON
// body. TS types are erased at runtime -- a literal-union field like
// `decision` still needs an explicit value check to actually catch a
// gateway/web contract drift instead of silently passing a stale value
// through.
//
// The value sets below mirror the runtime const objects orval generates
// alongside each literal-union type (CheckCheckResponseDecision,
// CheckFilterInfoVerdict, CheckRedactorInfoVerdict,
// CheckExternalRefInfoVerdict, CheckSpotlightInfoFormat,
// CheckWrappedChunkTrust -- all in src/__codegen__/rest/check/types/), which
// in turn come from the `enums:` tags pact-gateway PR #134 added to
// check.CheckResponse's closed-set fields (schema/check/swagger.yaml). Reuse
// the generated consts rather than hand-listing the values a second time, so
// a future contract change only needs re-vendoring + regen to take effect
// here too.
//
// classifier.label and CheckInput.kind are deliberately NOT validated here --
// pact-gateway does not constrain either to a closed set (classifier labels
// come from whichever model checkpoint is loaded; kind is documented but not
// swagger-`enum`'d), so they stay open strings by design.
//
// Unlike parseDecisionPayload (called per-row while mapping over an array of
// audit events, where returning null-and-skip is the natural shape),
// parseCheckResponse's two call sites (useTestLabRun.runCheck,
// DashboardQuickProbe.runProbe) already wrap the single /v1/check call in a
// try/catch that transitions to an 'error' status. Throwing a structured
// error lets a parse failure fall straight into that existing catch instead
// of requiring a second null-check at every call site.
export class CheckResponseParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CheckResponseParseError';
  }
}

const DECISIONS: ReadonlySet<string> = new Set(
  Object.values(CheckCheckResponseDecision)
);
const FILTER_VERDICTS: ReadonlySet<string> = new Set(
  Object.values(CheckFilterInfoVerdict)
);
const REDACTOR_VERDICTS: ReadonlySet<string> = new Set(
  Object.values(CheckRedactorInfoVerdict)
);
const EXTERNAL_REF_VERDICTS: ReadonlySet<string> = new Set(
  Object.values(CheckExternalRefInfoVerdict)
);
const SPOTLIGHT_FORMATS: ReadonlySet<string> = new Set(
  Object.values(CheckSpotlightInfoFormat)
);
const SPOTLIGHT_TRUST: ReadonlySet<string> = new Set(
  Object.values(CheckWrappedChunkTrust)
);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const assertEnumField = (
  set: ReadonlySet<string>,
  value: unknown,
  field: string
): void => {
  if (typeof value !== 'string' || !set.has(value)) {
    throw new CheckResponseParseError(
      `check response ${field}: unexpected value ${JSON.stringify(value)}`
    );
  }
};

const assertRecordField = (
  value: unknown,
  field: string
): Record<string, unknown> | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    throw new CheckResponseParseError(
      `check response ${field} is not an object`
    );
  }

  return value;
};

const assertArrayField = (value: unknown, field: string): unknown[] => {
  if (!Array.isArray(value)) {
    throw new CheckResponseParseError(
      `check response ${field} is not an array`
    );
  }

  return value;
};

// parseCheckResponse validates the /v1/check response body against the
// closed sets its generated wire type now expresses, throwing
// CheckResponseParseError on structural drift instead of letting an
// unchecked cast paper over it.
export const parseCheckResponse = (raw: unknown): CheckResponse => {
  if (!isRecord(raw)) {
    throw new CheckResponseParseError('check response is not an object');
  }

  assertEnumField(DECISIONS, raw.decision, 'decision');
  if (typeof raw.latency_ms !== 'number') {
    throw new CheckResponseParseError('check response latency_ms is missing');
  }
  if (typeof raw.request_id !== 'string') {
    throw new CheckResponseParseError('check response request_id is missing');
  }

  const filter = assertRecordField(raw.filter, 'filter');
  if (filter?.verdict !== undefined) {
    assertEnumField(FILTER_VERDICTS, filter.verdict, 'filter.verdict');
  }

  const redactor = assertRecordField(raw.redactor, 'redactor');
  if (redactor?.verdict !== undefined) {
    assertEnumField(REDACTOR_VERDICTS, redactor.verdict, 'redactor.verdict');
  }

  // consensus has no closed-set field of its own today (PACT-623 added it
  // duration_ms-only) -- still validated as a record so a malformed payload
  // fails parseCheckResponse's parse-don't-cast contract instead of reaching
  // `data.consensus.duration_ms` unguarded downstream.
  assertRecordField(raw.consensus, 'consensus');

  const externalRefs = assertRecordField(raw.external_refs, 'external_refs');
  if (externalRefs?.refs !== undefined) {
    assertArrayField(externalRefs.refs, 'external_refs.refs').forEach(
      (ref, i) => {
        if (!isRecord(ref)) {
          throw new CheckResponseParseError(
            `check response external_refs.refs[${i}] is not an object`
          );
        }
        if (ref.verdict !== undefined) {
          assertEnumField(
            EXTERNAL_REF_VERDICTS,
            ref.verdict,
            `external_refs.refs[${i}].verdict`
          );
        }
      }
    );
  }

  const spotlight = assertRecordField(raw.spotlight, 'spotlight');
  if (spotlight?.format !== undefined) {
    assertEnumField(SPOTLIGHT_FORMATS, spotlight.format, 'spotlight.format');
  }
  if (spotlight?.chunks !== undefined) {
    assertArrayField(spotlight.chunks, 'spotlight.chunks').forEach(
      (chunk, i) => {
        if (!isRecord(chunk)) {
          throw new CheckResponseParseError(
            `check response spotlight.chunks[${i}] is not an object`
          );
        }
        if (chunk.trust !== undefined) {
          assertEnumField(
            SPOTLIGHT_TRUST,
            chunk.trust,
            `spotlight.chunks[${i}].trust`
          );
        }
      }
    );
  }

  // diagnostics.causal_spans (PACT-734/745) has no closed-set field of its
  // own -- same reasoning as consensus above -- but each element must still
  // be an object, same shape check as external_refs.refs.
  const diagnostics = assertRecordField(raw.diagnostics, 'diagnostics');
  if (diagnostics?.causal_spans !== undefined) {
    assertArrayField(
      diagnostics.causal_spans,
      'diagnostics.causal_spans'
    ).forEach((span, i) => {
      if (!isRecord(span)) {
        throw new CheckResponseParseError(
          `check response diagnostics.causal_spans[${i}] is not an object`
        );
      }
    });
  }

  // The checks above have already validated every closed-set field and the
  // three required top-level fields; `raw` is a CheckResponse at this point.
  // Widened through `unknown` because `Record<string, unknown>` and
  // CheckResponse don't structurally overlap enough for a direct assertion
  // (every optional sub-object field is still typed `unknown` here).
  return raw as unknown as CheckResponse;
};

// ─── domain record ────────────────────────────────────────────────────────────

interface TestRunBase {
  id: string;
  input: string;
  attackType: string;
  latencyMs: number;
  timestamp: string;
}

// TestRun is a discriminated union on `status` rather than a single interface
// with optional decision/error fields -- a failed run has no gateway
// decision to report, and narrowing on `status` lets a consumer read
// `run.decision` in the 'ok' branch without an unsafe cast of an empty wire
// string into the 'allow' | 'block' closed set.
export type TestRun =
  | (TestRunBase & {
      status: 'ok';
      decision: 'allow' | 'block';
      reason?: string;
      filterRuleId?: string;
    })
  | (TestRunBase & {
      status: 'error';
      error?: string;
    });

// ─── persisted run + corpus types (gateway API shape) ────────────────────────
//
// PACT-465 repoints Test Lab's "Save to corpus" and run-history save/list
// onto the gateway's POST /v1/benchmark/corpus and GET+POST
// /v1/benchmark/testlab/runs (schema/benchmark, pulled from pact-gateway).
// The gateway resolves the actor from the session server-side -- callers
// never send an actor, unlike the retired X-Pact-Actor direct-proxy path.
// The generated wire types are re-exported under the domain vocabulary the
// Test Lab UI already used pre-migration.
export type TestLabRunRecord = BenchmarkTestLabRunBody;
export type SaveRunPayload = BenchmarkSaveTestLabRunRequest;
export type SaveCorpusPayload = BenchmarkSaveCorpusRequest;

export const toTestRun = (r: TestLabRunRecord): TestRun => {
  const base: TestRunBase = {
    id: r.id,
    input: r.content,
    attackType: r.attack_type,
    latencyMs: r.latency_ms,
    timestamp: new Date(r.created_at * 1000).toISOString(),
  };

  if (r.status === 'error') {
    return { ...base, status: 'error', error: r.error || undefined };
  }

  // Defensive: an 'ok' (or unset-status) row is only ever written by the
  // gateway with a non-empty decision -- this branch should not be reached
  // on real data. If it is, there is nothing meaningful to show as a
  // verdict; treat it as a failed run rather than casting an empty/unknown
  // string into the 'allow' | 'block' closed set.
  if (r.decision !== 'allow' && r.decision !== 'block') {
    return { ...base, status: 'error', error: r.error || undefined };
  }

  return {
    ...base,
    status: 'ok',
    decision: r.decision,
    reason: r.reason || undefined,
    filterRuleId: r.filter_rule_id || undefined,
  };
};

// ─── pipeline constants ───────────────────────────────────────────────────────

// Attack examples are fetched via useTestLabCorpusExamples (see
// use_test_lab_corpus_examples.ts and
// app/api/pact/benchmark/v1/corpus/examples/route.ts).
// Custom is the only static chip - it has no pre-filled example.
export const STATIC_CHIPS: AttackChip[] = [
  { id: 'custom', label: 'Custom', example: '' },
];

// LayerDefinition is the single source of truth for which pipeline stages the
// Test Lab visualises, in display order. BLANK_LAYERS and the stage count
// used elsewhere (e.g. TestLabPipelineCard's rendering) derive from this list
// rather than hard-coding the current two stages.
export interface LayerDefinition {
  id: string;
  label: string;
}

// The four stages always visualised. 'sandbox' is a fifth, conditionally
// spliced in (see deriveLayerDefinitions below) only for a run whose request
// declared external_refs -- it has no fixed position in this base list
// because whether it exists at all is a per-run fact, not a per-app one.
export const LAYER_DEFINITIONS: LayerDefinition[] = [
  { id: 'filter', label: 'Filter' },
  { id: 'classifier', label: 'Classifier' },
  { id: 'consensus', label: 'Consensus' },
  { id: 'redactor', label: 'Redactor' },
];

const SANDBOX_DEFINITION: LayerDefinition = { id: 'sandbox', label: 'Sandbox' };

export const BLANK_LAYERS: LayerState[] = LAYER_DEFINITIONS.map((def) => ({
  ...def,
  decision: 'pending' as LayerDecision,
}));

// deriveLayerDefinitions returns this run's actual stage list, in true
// pipeline execution order (policy -> filter -> classifier -> sandbox ->
// consensus -> redactor -> tool-mitigation -> CEL; policy/tool-mitigation/CEL
// are virtual -- they have no chip). Sandbox is spliced in at its real
// execution position (between classifier and consensus) only when
// `external_refs` is present on the response -- it exists on the wire only
// when the request declared references to scan, so its presence there is
// exactly the "did this run's request want a sandbox stage" signal.
//
// Building the display list per-run (rather than a fixed 5-stage constant)
// is what keeps a sandbox block from stranding Consensus/Redactor to its
// LEFT showing "skipped" chips that visually precede the stage that
// allegedly skipped them.
export const deriveLayerDefinitions = (
  data: CheckResponse
): LayerDefinition[] => {
  const [filter, classifier, consensus, redactor] = LAYER_DEFINITIONS;
  if (!data.external_refs) return LAYER_DEFINITIONS;

  return [filter, classifier, SANDBOX_DEFINITION, consensus, redactor];
};

// ─── layer inference ────────────────────────────────────────────────────────
// PACT-702: block attribution is driven exclusively from the gateway's
// top-level `reason` (the aggregate CheckChallenge.Evaluate fold already
// resolved to a single canonical value pact-gateway commits to as a closed
// set -- see BLOCKING_STAGE_OF below). The structural sub-objects (`filter`,
// `classifier`, `consensus`, `redactor`, `external_refs`) are consulted only
// for DETAIL (rule id, verdict, score, span count) once attribution is
// already settled -- never as a second, competing attribution heuristic.
//
// This replaces the pre-PACT-702 heuristics (`filter.verdict === 'hostile'`,
// `decision === 'block' && classifier responded`), which misattributed any
// downstream block (e.g. consensus_enforced) to whichever earlier stage
// happened to have structural signal, because neither heuristic looked at
// `reason` at all.

type StageId = 'filter' | 'classifier' | 'sandbox' | 'consensus' | 'redactor';

// Only the four stages that can ever precede another visualised stage need
// a label here -- redactor is always last in execution order, so it can
// never be the `haltedAt` stage a later chip's skip reason names.
const STAGE_LABEL: Partial<Record<StageId, string>> = {
  filter: 'Filter',
  classifier: 'Classifier',
  sandbox: 'Sandbox',
  consensus: 'Consensus',
};

// BLOCKING_STAGE_OF is the closed set of gateway block reasons that this UI
// attributes to one of the five visualised stages, mirroring pact-gateway's
// internal/pipeline/stages.go byte-for-byte (verified against gateway HEAD
// 7352bcf, PACT-702):
//
//   - filter_hostile / filter_suspicious_enforced -> filterStage's two block
//     branches (hostile verdict; suspicious verdict promoted by vector
//     enforce mode).
//   - classifier_enforced -> classifierStage's high-confidence enforce
//     branch. classifier_protocol_error -> classifierStage's `default:`
//     branch (unrecognised label, fails CLOSED per stages.go's comment "fail
//     closed so a silent classifier regression cannot wave bad traffic
//     through"). The task spec listed classifier_protocol_error as a
//     non-block diagnostic reason; stages.go (the spec's own cited
//     authority for this closed set) sets Verdict=Block for it, so it is
//     mapped here as a classifier block -- otherwise a real block would
//     render with no stage claiming it.
//   - external_ref_hostile / external_ref_not_allowlisted /
//     external_ref_unfetchable -> sandboxStage's fetch-and-rescan block.
//   - consensus_enforced -> consensusStage's quorum-confirmed-malicious
//     branch.
//
// `policy_token_denied` (stage 0, before filter) and `cel_rule_fired` (the
// CEL stage, after every visualised stage) are deliberately absent: neither
// virtual stage has a chip, so a block via either reason is never force-
// attributed to a visualised stage -- see cutoffFor's 'before-filter' case
// and the "no cutoff" default respectively.
const BLOCKING_STAGE_OF: Record<string, StageId> = {
  filter_hostile: 'filter',
  filter_suspicious_enforced: 'filter',
  classifier_enforced: 'classifier',
  classifier_protocol_error: 'classifier',
  external_ref_hostile: 'sandbox',
  external_ref_not_allowlisted: 'sandbox',
  external_ref_unfetchable: 'sandbox',
  consensus_enforced: 'consensus',
};

// blockingStageId resolves which visualised stage (if any) is the true
// source of a block decision. Reason-driven first; falls back to the
// pre-PACT-249 signal (`filter_rule_id` set, structural `filter` sub-object
// absent entirely, decision=block) only for gateway builds old enough to
// predate the `reason` closed set this map covers -- modern builds always
// carry both surfaces together (handler.go sets top-level filter_rule_id
// from the same RuleID the sub-object mirrors), so this fallback can never
// misfire against a modern, differently-attributed block.
const blockingStageId = (data: CheckResponse): StageId | undefined => {
  if (data.reason && BLOCKING_STAGE_OF[data.reason]) {
    return BLOCKING_STAGE_OF[data.reason];
  }
  if (
    data.filter === undefined &&
    data.filter_rule_id &&
    data.decision === 'block'
  ) {
    return 'filter';
  }

  return undefined;
};

// cutoffFor resolves how far the pipeline actually ran, independent of
// whether the halt was itself a block: `classifier_unreachable` halts the
// pipeline (stages.go: "the transport fail-open HALTS the pipeline... there
// is nothing for consensus or the redactor to annotate") while still
// resolving to an ALLOW decision. `policy_token_denied` halts before the
// filter stage runs at all -- every visualised stage was skipped. Every
// other reason either maps to a visualised stage via blockingStageId (cutoff
// sits right after that stage) or is a downstream/unattributed reason
// (`cel_rule_fired`, `policy_tool_mitigation`, an unmapped future reason)
// that never halts anything upstream -- every stage then renders its own,
// independently-derived state.
const cutoffFor = (
  data: CheckResponse,
  order: StageId[]
): { afterIndex: number } | undefined => {
  if (data.reason === 'policy_token_denied') return { afterIndex: -1 };
  if (data.reason === 'classifier_unreachable') {
    const idx = order.indexOf('classifier');

    return idx === -1 ? undefined : { afterIndex: idx };
  }
  const blocking = blockingStageId(data);
  if (!blocking) return undefined;
  const idx = order.indexOf(blocking);

  return idx === -1 ? undefined : { afterIndex: idx };
};

const skipReason = (
  haltedAt: StageId | undefined,
  data: CheckResponse
): string => {
  if (!haltedAt) return 'Skipped - request denied before the pipeline ran';
  if (haltedAt === 'classifier' && data.reason === 'classifier_unreachable') {
    return 'Skipped - classifier unreachable, pipeline halted';
  }

  return `Skipped - ${STAGE_LABEL[haltedAt] ?? haltedAt} blocked`;
};

const roundMs = (ms: number | undefined): number | undefined =>
  ms === undefined ? undefined : Math.round(ms);

const filterRuleId = (data: CheckResponse): string | undefined =>
  data.filter?.rule_id || data.filter_rule_id || undefined;

// filterReason surfaces the enforcement nuance a plain verdict/decision pair
// cannot: a shadow match and an observe/redact-suppressed hostile/suspicious
// match both leave the filter layer at 'allow', but a reviewer still needs
// to see which rule fired. A suspicious verdict promoted to a block by
// vector enforcement gets its own wording distinguishing it from a hostile
// verdict, per the task's "surface enforcement nuance" requirement.
const filterReason = (
  data: CheckResponse,
  blocked: boolean
): string | undefined => {
  const ruleId = filterRuleId(data);
  const verdict = data.filter?.verdict;
  if (!blocked) {
    if (data.filter?.shadow && ruleId) {
      return `Shadow rule ${ruleId} matched (not enforced)`;
    }
    if ((verdict === 'hostile' || verdict === 'suspicious') && ruleId) {
      return `Matched rule ${ruleId} (not enforced)`;
    }

    return undefined;
  }
  if (data.reason === 'filter_suspicious_enforced') {
    return ruleId
      ? `Suspicious verdict enforced under vector mode (rule ${ruleId})`
      : 'Suspicious verdict enforced under vector mode';
  }
  if (ruleId) return `Matched rule ${ruleId}`;

  return data.reason || 'Filter matched';
};

const classifierReason = (
  data: CheckResponse,
  blocked: boolean
): string | undefined => {
  switch (data.reason) {
    case 'classifier_unreachable':
      return 'Classifier unreachable - fail open';
    case 'classifier_unknown':
      return 'Classifier declined to score - fail open';
    case 'classifier_protocol_error':
      return 'Classifier returned an unrecognised label - fail closed';
    default:
      break;
  }
  if (!data.classifier?.label) return undefined;
  if (blocked) return data.reason || 'Blocked by classifier';
  if (data.reason === 'classifier_mitigated') {
    return 'Tagged, then cleared by a PII-redaction re-check';
  }
  if (data.reason === 'classifier_tagged') {
    return 'Tagged by classifier (deferred to consensus)';
  }

  return undefined;
};

const sandboxReason = (
  data: CheckResponse,
  blocked: boolean
): string | undefined => {
  if (!blocked) return undefined;
  switch (data.reason) {
    case 'external_ref_hostile':
      return 'A scanned reference was hostile';
    case 'external_ref_not_allowlisted':
      return 'A scanned reference was not allow-listed';
    case 'external_ref_unfetchable':
      return 'A scanned reference could not be fetched';
    default:
      return data.reason;
  }
};

const consensusReason = (
  data: CheckResponse,
  decision: LayerDecision
): string | undefined => {
  if (decision === 'block') return 'Consensus vote confirmed malicious content';
  if (decision === 'skip') {
    if (data.reason === 'classifier_unknown') {
      return 'Skipped - classifier declined to score';
    }

    return 'Skipped - confidence above threshold, or consensus not configured';
  }

  return undefined;
};

const redactorReason = (data: CheckResponse): string | undefined => {
  switch (data.redactor?.verdict) {
    case 'redacted':
      return `Redacted ${data.redactor.spans?.length ?? 0} span(s)`;
    case 'unknown':
      return 'Redactor unreachable - fail open, content unmodified';
    default:
      return undefined;
  }
};

// blankDetail clears every optional field a previous run's layer state may
// have populated. deriveStageState below always spreads this first so a
// stale ruleId/confidence/span count from an earlier run's response can
// never leak onto a differently-shaped run's layer.
const blankDetail: Omit<LayerState, 'id' | 'label' | 'decision'> = {
  ruleId: undefined,
  reason: undefined,
  latencyMs: undefined,
  confidence: undefined,
  classifierLabel: undefined,
  bypassed: false,
  redactedSpanCount: undefined,
  redactedSpanLabels: undefined,
  refsScanned: undefined,
  refsBlocked: undefined,
  refsMitigated: undefined,
  causalSpans: undefined,
};

// stageCausalSpans (PACT-745) attaches diagnostics.causal_spans to whichever
// stage actually blocked the request -- causal_spans is a top-level wire
// field (not nested under any one stage's sub-object), so blockingStageId is
// the single attribution authority here too, same as every other detail
// field in deriveStageState.
const stageCausalSpans = (
  data: CheckResponse,
  id: StageId,
  blockingStage: StageId | undefined
): LayerState['causalSpans'] =>
  blockingStage === id ? data.diagnostics?.causal_spans : undefined;

// deriveStageState computes one stage's real (non-skipped, non-bypassed)
// state, reading only DETAIL from the structural sub-objects -- `blocked`
// (via blockingStageId, called once by the caller) is the single attribution
// authority.
const deriveStageState = (
  id: StageId,
  data: CheckResponse,
  blockingStage: StageId | undefined
): Omit<LayerState, 'id' | 'label'> => {
  const blocked = blockingStage === id;

  switch (id) {
    case 'filter':
      return {
        ...blankDetail,
        decision: blocked ? 'block' : 'allow',
        ruleId: filterRuleId(data),
        reason: filterReason(data, blocked),
        latencyMs: roundMs(data.filter?.duration_ms),
        causalSpans: stageCausalSpans(data, id, blockingStage),
      };
    case 'classifier':
      return {
        ...blankDetail,
        decision: blocked ? 'block' : 'allow',
        reason: classifierReason(data, blocked),
        confidence: data.classifier?.score,
        classifierLabel: data.classifier?.label,
        latencyMs: roundMs(data.classifier?.duration_ms),
        causalSpans: stageCausalSpans(data, id, blockingStage),
      };
    case 'sandbox':
      return {
        ...blankDetail,
        decision: blocked ? 'block' : 'allow',
        reason: sandboxReason(data, blocked),
        refsScanned: data.external_refs?.scanned,
        refsBlocked: data.external_refs?.blocked,
        refsMitigated: data.external_refs?.mitigated,
        causalSpans: stageCausalSpans(data, id, blockingStage),
      };
    case 'consensus': {
      const decision: LayerDecision = blocked
        ? 'block'
        : data.consensus
          ? 'allow'
          : 'skip';

      return {
        ...blankDetail,
        decision,
        reason: consensusReason(data, decision),
        latencyMs: roundMs(data.consensus?.duration_ms),
        causalSpans: stageCausalSpans(data, id, blockingStage),
      };
    }
    case 'redactor': {
      if (!data.redactor?.verdict) {
        // No redactor sub-object and nothing upstream forced this stage to
        // skip -- either a pre-PACT-249 build that never sent one, or a
        // block reason this map does not (yet) recognise. Stay honest
        // rather than asserting a "ran" state the response cannot back.
        return {
          ...blankDetail,
          decision: 'skip',
          reason: 'Skipped - redactor status unknown',
        };
      }

      return {
        ...blankDetail,
        decision: 'allow',
        reason: redactorReason(data),
        redactedSpanCount: data.redactor.spans?.length,
        redactedSpanLabels: (data.redactor.spans ?? [])
          .map((s) => s.label)
          .filter((l): l is string => Boolean(l)),
        latencyMs: roundMs(data.redactor.duration_ms),
      };
    }
  }
};

// resultCausalSpans (PACT-757) surfaces diagnostics.causal_spans on the
// Result node when a block cannot be attributed to any visualised stage
// (cel_rule_fired, policy_token_denied, or any future unmapped reason).
// stageCausalSpans above only ever attaches spans to the one stage that
// actually blocked, so an unattributed block's spans would otherwise never
// render anywhere in the pipeline view -- mirrors the audit feature's
// PACT-749 pattern (CausalSpanList with attributed=false), just surfaced at
// the overall-result level instead of a per-stage level since neither the
// CEL nor the policy engine has a visualised chip.
export const resultCausalSpans = (
  data: CheckResponse
): LayerState['causalSpans'] =>
  data.decision === 'block' && !blockingStageId(data)
    ? data.diagnostics?.causal_spans
    : undefined;

// applyLiveLayers assembles every visualised layer's final state for one
// /v1/check response. It is the single inference path for both dev:mock and
// the real gateway (PACT-702 deleted the mock-only `_mock_layers` escape
// hatch that used to bypass it) -- a mocked scenario and a live gateway
// response with the same shape render identically.
export const applyLiveLayers = (
  prev: LayerState[],
  data: CheckResponse,
  bypassLayers: string[]
): LayerState[] => {
  const defs = deriveLayerDefinitions(data);
  const order = defs.map((d) => d.id as StageId);
  const cutoff = cutoffFor(data, order);
  const blockingStage = blockingStageId(data);

  return defs.map((def, i) => {
    const id = def.id as StageId;
    if (bypassLayers.includes(id)) {
      return (
        prev.find((l) => l.id === id) ?? {
          ...def,
          decision: 'pending' as LayerDecision,
        }
      );
    }
    if (cutoff && i > cutoff.afterIndex) {
      return {
        ...def,
        ...blankDetail,
        decision: 'skip' as LayerDecision,
        reason: skipReason(order[cutoff.afterIndex], data),
      };
    }

    return { ...def, ...deriveStageState(id, data, blockingStage) };
  });
};

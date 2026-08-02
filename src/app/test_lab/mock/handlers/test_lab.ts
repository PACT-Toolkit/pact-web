import { http, HttpResponse, type RequestHandler } from 'msw';
import { v4 as uuidv4 } from 'uuid';

import { db } from '@/mocks/data/dbFactory';
import {
  type CheckExternalRef,
  type CheckSpotlightChunk,
} from '@/src/__codegen__/rest/check';
import {
  computeCausalSpans,
  runSandboxProbe,
  runSpotlightProbe,
  sandboxBlocked,
} from '@/src/app/gateway/mock/data/gateway';
import { runRedactor } from '@/src/app/redactor/mock/data/redactor';
import { MSW_PACT_BASE } from '@/src/framework/msw';

import {
  filterMatchPattern,
  runClassifier,
  runConsensus,
  runFilter,
} from '../data/test_lab';

const TEST_LAB_RUN_DECISION_VALUES = new Set(['allow', 'block']);
const TEST_LAB_RUN_STATUS_VALUES = new Set(['ok', 'error']);

// validateSaveTestLabRunBody mirrors pact-gateway's POST
// /v1/benchmark/testlab/runs validation (PACT-595: failed-run support,
// schema/benchmark/swagger.yaml SaveTestLabRunRequest). content is always
// required (internal/features/benchmark/handler.go's saveTestLabRun:
// `req.Content == ""` -> "content is required"). Status defaults to "ok"
// when omitted; an "ok" run still requires a non-empty decision from the
// allow/block closed set (checked one layer deeper, in pact-benchmark's
// SaveTestLabRun gRPC handler), while an "error" run may omit decision
// entirely and instead carries a short error summary.
const validateSaveTestLabRunBody = (
  body: Record<string, unknown>
): string | undefined => {
  if (!body.content) {
    return 'content is required';
  }
  const status = (body.status as string) || 'ok';
  if (!TEST_LAB_RUN_STATUS_VALUES.has(status)) {
    return 'invalid request';
  }
  if (status === 'error') return undefined;

  if (!body.decision) {
    return 'content and decision are required';
  }
  if (!TEST_LAB_RUN_DECISION_VALUES.has(body.decision as string)) {
    return 'invalid request';
  }

  return undefined;
};

// validateSaveCorpusBody mirrors pact-gateway's POST /v1/benchmark/corpus
// validation (internal/features/benchmark/handler.go's saveCorpus:
// `req.Content == ""` -> "content is required"). No other field is
// required on either the gateway's SaveCorpusRequest or pact-benchmark's
// deeper SaveCorpusEntry gRPC check (_require_content in grpcserver.py).
const validateSaveCorpusBody = (
  body: Record<string, unknown>
): string | undefined => (body.content ? undefined : 'content is required');

export const handlers: RequestHandler[] = [
  http.get(`${MSW_PACT_BASE}/benchmark/v1/corpus/examples`, () =>
    HttpResponse.json(db.attackExamples.getAll())
  ),

  http.post(`${MSW_PACT_BASE}/gateway/v1/check`, async ({ request }) => {
    const body = (await request.json()) as {
      content?: string;
      kind?: string;
      traffic_source?: string;
      _bypass_layers?: string[];
      external_refs?: CheckExternalRef[];
      spotlight_chunks?: CheckSpotlightChunk[];
    };
    const content = body.content ?? '';
    const bypass = body._bypass_layers ?? [];

    // Mirrors pact-gateway's validateTrafficSource (PACT-484): a declared
    // traffic_source must match the decisions schema's pattern or the whole
    // request is rejected before any stage runs.
    const trafficSource = body.traffic_source;
    if (trafficSource && !/^[a-z0-9_-]{1,32}$/.test(trafficSource)) {
      return HttpResponse.json(
        { error: 'traffic_source: must match ^[a-z0-9_-]{1,32}$' },
        { status: 400 }
      );
    }

    await new Promise((r) => setTimeout(r, 120 + Math.random() * 80));

    // Reads the single stateful db.gatewayConfig row (PACT-473 made this
    // stateful so PATCH /v1/config/enforcement has something to mutate) --
    // sandboxEnabled/diagnosticsEnabled/spotlightFormat aren't PATCH-writable
    // fields, so this is equivalent to the old static-constant read, just
    // sourced from the one shared row instead of a second copy.
    const gatewayConfig = db.gatewayConfig.findFirst(() => true)!;
    const vectorEnforcing = gatewayConfig.vectorEnforceMode === 'enforce';
    const classifierEnforcing =
      gatewayConfig.classifierEnforceMode === 'enforce';
    const consensusInline = gatewayConfig.consensusMode === 'inline';
    const consensusThreshold = gatewayConfig.consensusThreshold ?? 0.55;

    // The pipeline below mirrors pact-gateway's stage order and halt
    // semantics byte-for-byte (internal/pipeline/service.go: "for _, st :=
    // range s.stages { halt, err := st.run(...); if halt { break } }") --
    // each stage below only runs once `blocked` is still false, exactly like
    // the real Check loop stopping at the first halting stage. This is what
    // makes dev:mock a faithful fixture for PACT-702's reason-driven
    // attribution logic (test_lab_check.ts's applyLiveLayers) rather than a
    // parallel computation that could drift from real halt behaviour.
    let blocked = false;
    let reason: string | undefined;

    // Stage 1: filter. `_bypass_layers` is a mock-only escape hatch (Test
    // Lab's "pass through" re-run) -- the real gateway ignores it entirely.
    const filterBypassed = bypass.includes('filter');
    const filterResult = filterBypassed ? undefined : runFilter(content);
    if (filterResult?.verdict === 'hostile') {
      blocked = true;
      reason = 'filter_hostile';
    } else if (filterResult?.verdict === 'suspicious' && vectorEnforcing) {
      blocked = true;
      reason = 'filter_suspicious_enforced';
    }

    // Stage 2: classifier -- tags only, never decides block itself.
    const classifierResult = !blocked ? runClassifier(content) : undefined;
    let consensusRan = false;
    if (!blocked && classifierResult?.label === 'sensitive') {
      const highConfidence = classifierResult.score >= consensusThreshold;
      if (highConfidence) {
        if (classifierEnforcing) {
          blocked = true;
          reason = 'classifier_enforced';
        }
      } else if (consensusInline) {
        consensusRan = true;
        const { malicious } = runConsensus(content);
        if (classifierEnforcing && malicious) {
          blocked = true;
          reason = 'consensus_enforced';
        }
      }
      // Shadow consensusMode defers the vote entirely (matches the real
      // gateway's DeferConsensusVote path) -- never blocks inline.
    }

    // Stage 3: sandbox re-scan (PACT-236/327). Only runs if nothing upstream
    // already halted the pipeline, same as the real gateway.
    const externalRefsResult = !blocked
      ? runSandboxProbe(
          body.external_refs,
          Boolean(gatewayConfig.sandboxEnabled)
        )
      : undefined;
    if (!blocked && sandboxBlocked(externalRefsResult)) {
      blocked = true;
      // The mock's sandbox simulation (gateway.ts's refVerdict) only ever
      // produces a 'hostile' verdict for a ref that sets `blocked` > 0 --
      // 'external_ref_not_allowlisted' has no mock scenario today.
      reason = 'external_ref_hostile';
    }

    // Stage 4: redactor. Runs only when nothing upstream halted, mirroring
    // the real gateway's stage loop -- pact-redactor is bidirectional, but
    // that only means it inspects both request/response content when it
    // DOES run, not that it runs after an already-halted pipeline. Shared
    // with createRedactorMockData's seed data via
    // redactor/mock/data/redactor.ts so /redactor's ad-hoc test panel
    // (PACT-324) exercises the same detection logic as the live console.
    const redactorResult = !blocked ? runRedactor(content) : undefined;

    const decision = blocked ? 'block' : 'allow';

    // Diagnostics (PACT-303/327): the causal-diagnostic harness only ever
    // replays a block decision, and only when the gateway build has it
    // enabled. filterMatchPattern resolves the exact rule the filter stage
    // matched so the span lines up with the submitted content byte-for-byte.
    // No span for a suspicious-verdict block -- filterMatchPattern only
    // covers the hostile pattern tables, matching maybeDiagnose's own
    // reason-prefix gate on the real gateway.
    const diagnosticsResult = computeCausalSpans(
      content,
      reason === 'filter_hostile' ? filterMatchPattern(content) : undefined,
      Boolean(gatewayConfig.diagnosticsEnabled),
      decision === 'block'
    );

    // Spotlight (PACT-327): populated on the allow path only, mirroring the
    // swagger contract ("Populated on allow path only").
    const spotlightResult =
      decision === 'allow'
        ? runSpotlightProbe(
            body.spotlight_chunks,
            gatewayConfig.spotlightFormat ?? 'delim'
          )
        : undefined;

    const requestId = `req-test-${uuidv4().slice(0, 6)}`;
    const latencyMs = Math.floor(3 + Math.random() * 8);
    const createdAt = new Date().toISOString();

    // The real gateway publishes a pact.decisions audit event for every
    // /v1/check (outbox -> Kafka -> pact-audit); mirror that here so a
    // mock-mode probe or Test Lab run lands in the dashboard's live stream
    // too, carrying the caller's declared traffic_source. Payload shape
    // matches filter.ts's seeded rows plus the stage sub-objects this
    // handler already computed for the response.
    db.decisions.create({
      requestId,
      createdAt,
      payloadJson: JSON.stringify({
        request_id: requestId,
        decision,
        reason,
        ...(trafficSource ? { traffic_source: trafficSource } : {}),
        filter:
          filterResult &&
          (filterResult.verdict !== 'safe' || filterResult.ruleId)
            ? {
                verdict: filterResult.verdict,
                rule_id: filterResult.ruleId,
                shadow: false,
              }
            : undefined,
        classifier: classifierResult
          ? { label: classifierResult.label, score: classifierResult.score }
          : undefined,
        redactor: redactorResult,
        latency_ms: latencyMs,
        created_at: createdAt,
      }),
    });

    return HttpResponse.json({
      request_id: requestId,
      decision,
      reason,
      // Modern builds set this alongside the `filter` sub-object below,
      // never instead of it (handler.go's writeDecision sets both from the
      // same RuleID) -- kept for callers still reading the legacy field.
      filter_rule_id:
        reason === 'filter_hostile' || reason === 'filter_suspicious_enforced'
          ? filterResult!.ruleId
          : undefined,
      // Presence mirrors pact-gateway's FilterOutcome.HasSignal(): omitted
      // entirely for the ordinary safe-verdict, no-rule-fired case.
      filter:
        filterResult && (filterResult.verdict !== 'safe' || filterResult.ruleId)
          ? {
              verdict: filterResult.verdict,
              rule_id: filterResult.ruleId,
              shadow: false,
              duration_ms: 1 + Math.random() * 4,
            }
          : undefined,
      classifier: classifierResult
        ? {
            label: classifierResult.label,
            score: classifierResult.score,
            duration_ms: 12 + Math.random() * 22,
          }
        : undefined,
      // PACT-682/623: Ran is the dedicated presence signal, set alongside
      // Duration -- consensus never rendering-relevant unless it actually
      // voted inline.
      consensus: consensusRan
        ? { duration_ms: 30 + Math.random() * 60 }
        : undefined,
      redactor: redactorResult
        ? { ...redactorResult, duration_ms: 2 + Math.random() * 3 }
        : undefined,
      external_refs: externalRefsResult,
      spotlight: spotlightResult,
      diagnostics: diagnosticsResult
        ? { causal_spans: diagnosticsResult }
        : undefined,
      latency_ms: latencyMs,
    });
  }),

  // PACT-465: corpus save + run-history save/list moved from the direct
  // pact-benchmark proxy (${MSW_PACT_BASE}/benchmark/v1/...) onto the gateway
  // edge proxy, matching the schema/benchmark orval group's new baseUrl.
  http.post(
    `${MSW_PACT_BASE}/gateway/v1/benchmark/corpus`,
    async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const validationError = validateSaveCorpusBody(body);
      if (validationError) {
        return HttpResponse.json(validationError, { status: 400 });
      }

      await new Promise((r) => setTimeout(r, 60));

      return HttpResponse.json(
        { id: uuidv4(), status: 'created' },
        { status: 201 }
      );
    }
  ),

  http.get(
    `${MSW_PACT_BASE}/gateway/v1/benchmark/testlab/runs`,
    ({ request }) => {
      const url = new URL(request.url);
      const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
      const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
      const all = [...db.testLabRuns.getAll()].reverse();
      const page = all.slice(offset, offset + limit);

      return HttpResponse.json({ runs: page, total: all.length });
    }
  ),

  http.post(
    `${MSW_PACT_BASE}/gateway/v1/benchmark/testlab/runs`,
    async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const validationError = validateSaveTestLabRunBody(body);
      if (validationError) {
        return HttpResponse.json(validationError, { status: 400 });
      }

      const status = ((body.status as string) || 'ok') as 'ok' | 'error';
      const run = db.testLabRuns.create({
        id: uuidv4(),
        content: String(body.content),
        attack_type: String(body.attack_type ?? 'custom'),
        status,
        decision:
          status === 'error' ? '' : (body.decision as 'allow' | 'block'),
        error: String(body.error ?? ''),
        reason: String(body.reason ?? ''),
        filter_rule_id: String(body.filter_rule_id ?? ''),
        latency_ms: Number(body.latency_ms ?? 0),
        request_id: String(body.request_id ?? ''),
        created_at: Math.floor(Date.now() / 1000),
      });

      return HttpResponse.json({ id: run.id }, { status: 201 });
    }
  ),
];

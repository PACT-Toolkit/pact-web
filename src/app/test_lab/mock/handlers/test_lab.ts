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

import { filterMatchPattern, runClassifier, runFilter } from '../data/test_lab';

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
      _bypass_layers?: string[];
      external_refs?: CheckExternalRef[];
      spotlight_chunks?: CheckSpotlightChunk[];
    };
    const content = body.content ?? '';
    const bypass = body._bypass_layers ?? [];

    await new Promise((r) => setTimeout(r, 120 + Math.random() * 80));

    // Reads the single stateful db.gatewayConfig row (PACT-473 made this
    // stateful so PATCH /v1/config/enforcement has something to mutate) --
    // sandboxEnabled/diagnosticsEnabled/spotlightFormat aren't PATCH-writable
    // fields, so this is equivalent to the old static-constant read, just
    // sourced from the one shared row instead of a second copy.
    const gatewayConfig = db.gatewayConfig.findFirst(() => true)!;

    const filterBypassed = bypass.includes('filter');
    const filterResult = filterBypassed ? null : runFilter(content);
    const shouldRunClassifier =
      filterBypassed || filterResult?.decision === 'allow';
    const classifierResult = shouldRunClassifier
      ? runClassifier(content)
      : null;

    // Sandbox re-scan (PACT-236/327): runs regardless of filter/classifier
    // outcome, same as the real gateway's indirect-injection pipeline stage.
    // A hostile external_ref blocks the request even when filter/classifier
    // both allowed -- see gateway_sandbox.ts's docblock.
    const externalRefsResult = runSandboxProbe(
      body.external_refs,
      Boolean(gatewayConfig.sandboxEnabled)
    );

    const decision =
      filterResult?.decision === 'block' ||
      classifierResult?.decision === 'block' ||
      sandboxBlocked(externalRefsResult)
        ? 'block'
        : 'allow';

    const reason =
      filterResult?.decision === 'block'
        ? 'filter_hostile'
        : classifierResult?.decision === 'block'
          ? 'classifier_hostile'
          : sandboxBlocked(externalRefsResult)
            ? 'sandbox_hostile_external_ref'
            : undefined;

    // Redactor runs regardless of decision/kind, same as the real gateway
    // (pact-redactor is bidirectional -- see README.md). Shared with
    // createRedactorMockData's seed data via redactor/mock/data/redactor.ts
    // so /redactor's ad-hoc test panel (PACT-324) exercises the same
    // detection logic as the live console's fixtures.
    const redactorResult = runRedactor(content);

    // Diagnostics (PACT-303/327): the causal-diagnostic harness only ever
    // replays a block decision, and only when the gateway build has it
    // enabled. filterMatchPattern resolves the exact rule the filter stage
    // matched so the span lines up with the submitted content byte-for-byte.
    const diagnosticsResult = computeCausalSpans(
      content,
      filterResult?.decision === 'block'
        ? filterMatchPattern(content)
        : undefined,
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

    return HttpResponse.json({
      request_id: `req-test-${uuidv4().slice(0, 6)}`,
      decision,
      reason,
      filter_rule_id:
        filterResult?.decision === 'block' ? filterResult.ruleId : undefined,
      classifier: classifierResult
        ? { label: classifierResult.label, score: classifierResult.confidence }
        : undefined,
      redactor: redactorResult,
      external_refs: externalRefsResult,
      spotlight: spotlightResult,
      diagnostics: diagnosticsResult
        ? { causal_spans: diagnosticsResult }
        : undefined,
      latency_ms: Math.floor(3 + Math.random() * 8),
      _mock_layers: [
        filterBypassed
          ? {
              name: 'filter',
              decision: 'skip',
              reason: 'Bypassed by user',
              latency_ms: 0,
              confidence: 0,
            }
          : {
              name: 'filter',
              decision: filterResult!.decision,
              rule_id: filterResult!.ruleId,
              reason: filterResult!.reason ?? 'No rule match',
              latency_ms: Math.floor(1 + Math.random() * 4),
              confidence: filterResult!.confidence,
            },
        classifierResult
          ? {
              name: 'classifier',
              decision: classifierResult.decision,
              label: classifierResult.label,
              reason: classifierResult.reason ?? 'Clean input',
              latency_ms: Math.floor(12 + Math.random() * 22),
              confidence: classifierResult.confidence,
            }
          : {
              name: 'classifier',
              decision: 'skip',
              reason: 'Skipped — filter blocked',
              latency_ms: 0,
              confidence: 0,
            },
      ],
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

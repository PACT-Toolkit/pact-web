import { http, HttpResponse, type RequestHandler } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import {
  type AuditAnnotateDecisionRequest,
  type AuditAnnotateDecisionResponse,
  type AuditAuditEventResponse,
  type AuditListDecisionAnnotationsRequest,
  type AuditListDecisionAnnotationsResponse,
  type AuditRemoveDecisionAnnotationResponse,
} from '@/src/__codegen__/rest/audit';
import { matchesControlFilter } from '@/src/app/audit/domain/audit_filters';
import {
  persistDecisionAnnotationRequestId,
  removeDecisionAnnotationRequestId,
} from '@/src/app/audit/mock/data/audit';
import {
  computeComplianceReport,
  computeControlStats,
  computeLargeComplianceReport,
  FAILING_REPORT_OFFSET,
  FAILING_REPORT_SINCE_BEFORE_UNIX,
  LARGE_REPORT_SINCE_BEFORE_UNIX,
} from '@/src/app/audit/mock/data/audit_compliance_aggregate';
import { MOCK_USER_ID } from '@/src/framework/helpers/environment';
import { operatorOnlyForbiddenResponse } from '@/src/framework/msw/operator_gate';
import { parseDecisionPayload } from '@/src/lib/decisions/decision_payload';

// The maxAnnotationRequestIDs cap, mirrored from pact-gateway's
// internal/features/audit/handler.go so the mock 400s the same input the
// real gateway does.
const MAX_ANNOTATION_REQUEST_IDS = 200;

// Page-size bounds for the compliance report, mirroring pact-audit's clamp.
const DEFAULT_REPORT_LIMIT = 50;
const MAX_REPORT_LIMIT = 200;

const optionalNumber = (value: string | null): number | undefined =>
  value === null ? undefined : Number(value);

// Answers GET /v1/audit/events for every topic, pact.decisions included (the
// four decision seeders append to db.decisions). "All topics" (topic omitted)
// merges every pool, matching pact-audit's real QueryEvents
// behaviour (buildWhere only applies a topic predicate `if f.Topic != ""`).
// pact.policy has no pool -- it always resolves to an empty page, matching
// AuditWorkbench's documented "not yet available" copy for that topic.
export const handlers: RequestHandler[] = [
  http.get('*/v1/audit/events', ({ request }) => {
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic') ?? '';
    const requestId = url.searchParams.get('requestId');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
    const offset = Number(url.searchParams.get('offset') ?? '0');

    const controlFramework = url.searchParams.get('controlFramework');
    const controlId = url.searchParams.get('controlId');

    // Mirrors the gateway: the control filter needs both halves or neither.
    if (Boolean(controlFramework) !== Boolean(controlId)) {
      return HttpResponse.json(
        'controlFramework and controlId must be set together',
        { status: 400 }
      );
    }

    const pools: Record<string, AuditAuditEventResponse[]> = {
      'pact.auth': db.auditAuthEvents.getAll(),
      'pact.account': db.auditAccountEvents.getAll(),
      'pact.files': db.auditFilesEvents.getAll(),
      'pact.decisions': db.decisions.getAll(),
      'pact.policy': [],
    };

    const pool = topic ? (pools[topic] ?? []) : Object.values(pools).flat();

    const all = pool
      .filter((event) => !requestId || event.requestId === requestId)
      .filter((event) => {
        if (!controlFramework || !controlId) return true;
        const payload = parseDecisionPayload(event.payloadJson ?? '');

        return (
          payload !== null &&
          matchesControlFilter(payload, controlFramework, controlId)
        );
      })
      .sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() -
          new Date(a.createdAt ?? 0).getTime()
      );

    const page = all.slice(offset, offset + limit);

    return HttpResponse.json({ events: page, total: all.length });
  }),

  // Answers GET /v1/audit/control-stats. Same audit:stats gate as
  // GET /v1/audit/stats (403 for the non-operator personas).
  http.get('*/v1/audit/control-stats', ({ request }) => {
    const forbidden = operatorOnlyForbiddenResponse();
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);

    return HttpResponse.json(
      computeControlStats(db.decisions.getAll(), {
        sinceUnix: optionalNumber(searchParams.get('sinceUnix')),
        untilUnix: optionalNumber(searchParams.get('untilUnix')),
      })
    );
  }),

  // Answers GET /v1/audit/compliance-report: one entry per decision, newest
  // first, offset-paged. Same audit:stats gate as control-stats.
  http.get('*/v1/audit/compliance-report', ({ request }) => {
    const forbidden = operatorOnlyForbiddenResponse();
    if (forbidden) return forbidden;

    const { searchParams } = new URL(request.url);
    const sinceUnix = optionalNumber(searchParams.get('sinceUnix'));
    const untilUnix = optionalNumber(searchParams.get('untilUnix'));
    const limit = Math.min(
      Number(searchParams.get('limit') ?? DEFAULT_REPORT_LIMIT),
      MAX_REPORT_LIMIT
    );
    const offset = Number(searchParams.get('offset') ?? '0');

    // Large-dataset and mid-walk-failure scenarios, picked by a far-past
    // Since (see audit_compliance_aggregate.ts).
    if (
      sinceUnix !== undefined &&
      untilUnix !== undefined &&
      sinceUnix < LARGE_REPORT_SINCE_BEFORE_UNIX
    ) {
      if (
        sinceUnix < FAILING_REPORT_SINCE_BEFORE_UNIX &&
        offset >= FAILING_REPORT_OFFSET
      ) {
        return HttpResponse.json({ error: 'boom' }, { status: 500 });
      }

      return HttpResponse.json(
        computeLargeComplianceReport(
          { sinceUnix, untilUnix },
          { limit, offset }
        )
      );
    }

    return HttpResponse.json(
      computeComplianceReport(db.decisions.getAll(), {
        sinceUnix,
        untilUnix,
        limit,
        offset,
      })
    );
  }),

  // Answers POST /v1/audit/annotations. Error bodies use
  // HttpResponse.json(message, {status}) rather than HttpResponse.text --
  // the real gateway's error bodies are plain text (see this repo's
  // schema/audit/swagger.yaml PlainTextBadRequest response), but orval's
  // generated fetcher always does JSON.parse(await res.text()) regardless of
  // status, which would throw on a genuinely unquoted plain-text body.
  // HttpResponse.json on a string JSON-encodes it (wraps it in quotes),
  // which JSON.parse can read back as that same string -- mirrors the same
  // choice the gateway.ts PATCH handler already made for this exact
  // orval/plain-text mismatch.
  http.post('*/v1/audit/annotations', async ({ request }) => {
    const body = (await request.json()) as AuditAnnotateDecisionRequest;

    if (!body.requestId) {
      return HttpResponse.json('requestId is required', { status: 400 });
    }
    if (body.kind !== 'false_positive') {
      return HttpResponse.json('kind must be "false_positive"', {
        status: 400,
      });
    }

    const existing = db.auditAnnotations.findFirst(
      (annotation) =>
        annotation.requestId === body.requestId &&
        annotation.kind === body.kind &&
        annotation.actor === MOCK_USER_ID
    );
    if (!existing) {
      db.auditAnnotations.create({
        requestId: body.requestId,
        kind: body.kind,
      });
      persistDecisionAnnotationRequestId(body.requestId);
    }

    const response: AuditAnnotateDecisionResponse = { created: !existing };

    return HttpResponse.json(response);
  }),

  // Answers DELETE /v1/audit/annotations. Idempotent
  // like the real RemoveDecisionAnnotation RPC -- removing an annotation
  // that was never flagged (or already un-flagged) is a 200 with
  // `removed: false`, not a 404. Same plain-text error-body shape as the
  // POST handler above (HttpResponse.json on a string) for the same
  // orval/plain-text mismatch reason.
  http.delete('*/v1/audit/annotations', ({ request }) => {
    const url = new URL(request.url);
    const requestId = url.searchParams.get('requestId');
    const kind = url.searchParams.get('kind');

    if (!requestId) {
      return HttpResponse.json('requestId is required', { status: 400 });
    }
    if (kind !== 'false_positive') {
      return HttpResponse.json('kind must be "false_positive"', {
        status: 400,
      });
    }

    const existing = db.auditAnnotations.findFirst(
      (annotation) =>
        annotation.requestId === requestId &&
        annotation.kind === kind &&
        annotation.actor === MOCK_USER_ID
    );
    if (existing) {
      db.auditAnnotations.delete(
        (annotation) =>
          annotation.requestId === requestId &&
          annotation.kind === kind &&
          annotation.actor === MOCK_USER_ID
      );
      removeDecisionAnnotationRequestId(requestId);
    }

    const response: AuditRemoveDecisionAnnotationResponse = {
      removed: Boolean(existing),
    };

    return HttpResponse.json(response);
  }),

  // Answers POST /v1/audit/annotations/query. Not
  // offset-paginated -- returns every db.auditAnnotations row matching the
  // requested ids in one response, mirroring the real RPC's contract.
  http.post('*/v1/audit/annotations/query', async ({ request }) => {
    const body = (await request.json()) as AuditListDecisionAnnotationsRequest;
    const requestIds = body.requestIds ?? [];

    if (requestIds.length === 0) {
      return HttpResponse.json('requestIds must contain at least one id', {
        status: 400,
      });
    }
    if (requestIds.length > MAX_ANNOTATION_REQUEST_IDS) {
      return HttpResponse.json(
        `requestIds must contain at most ${MAX_ANNOTATION_REQUEST_IDS} ids`,
        { status: 400 }
      );
    }

    const idSet = new Set(requestIds);
    const response: AuditListDecisionAnnotationsResponse = {
      annotations: db.auditAnnotations
        .getAll()
        .filter((annotation) => idSet.has(annotation.requestId ?? '')),
    };

    return HttpResponse.json(response);
  }),
];

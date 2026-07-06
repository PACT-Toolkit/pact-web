import { http, HttpResponse, type RequestHandler } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import {
  type AnnotateDecisionRequest,
  type AnnotateDecisionResponse,
  type AuditEvent,
  type ListDecisionAnnotationsRequest,
  type ListDecisionAnnotationsResponse,
} from '@/src/__codegen__/rest/audit';
import { persistDecisionAnnotationRequestId } from '@/src/app/audit/mock/data/audit';
import { MOCK_USER_ID } from '@/src/framework/helpers/environment';

// PACT-464's maxAnnotationRequestIDs cap, mirrored from pact-gateway's
// internal/features/audit/handler.go so the mock 400s the same input the
// real gateway does.
const MAX_ANNOTATION_REQUEST_IDS = 200;

// Answers GET /v1/audit/events for every topic other than pact.decisions
// (filter.ts's handler owns that one, since pact.decisions is seeded there
// alongside consensus.ts). "All topics" (topic omitted) merges every pool
// including pact.decisions, matching pact-audit's real QueryEvents
// behaviour (buildWhere only applies a topic predicate `if f.Topic != ""`).
// pact.policy has no pool -- it always resolves to an empty page, matching
// AuditWorkbench's documented "not yet available" copy for that topic.
//
// Built from pools rather than an early "topic === pact.decisions ->
// undefined" guard so this handler is correct regardless of registration
// order relative to filter.ts's handler in mocks/handlers.ts.
export const handlers: RequestHandler[] = [
  http.get('*/v1/audit/events', ({ request }) => {
    const url = new URL(request.url);
    const topic = url.searchParams.get('topic') ?? '';
    const requestId = url.searchParams.get('requestId');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
    const offset = Number(url.searchParams.get('offset') ?? '0');

    const pools: Record<string, AuditEvent[]> = {
      'pact.auth': db.auditAuthEvents.getAll(),
      'pact.account': db.auditAccountEvents.getAll(),
      'pact.files': db.auditFilesEvents.getAll(),
      'pact.decisions': db.decisions.getAll(),
      'pact.policy': [],
    };

    const pool = topic ? (pools[topic] ?? []) : Object.values(pools).flat();

    const all = pool
      .filter((event) => !requestId || event.requestId === requestId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    const page = all.slice(offset, offset + limit);

    return HttpResponse.json({ events: page, total: all.length });
  }),

  // Answers POST /v1/audit/annotations (PACT-464/PACT-474). Error bodies use
  // HttpResponse.json(message, {status}) rather than HttpResponse.text --
  // the real gateway's error bodies are plain text (see this repo's
  // schema/audit/swagger.yaml PlainTextBadRequest response), but orval's
  // generated fetcher always does JSON.parse(await res.text()) regardless of
  // status, which would throw on a genuinely unquoted plain-text body.
  // HttpResponse.json on a string JSON-encodes it (wraps it in quotes),
  // which JSON.parse can read back as that same string -- mirrors the same
  // choice PACT-473's gateway.ts PATCH handler already made for this exact
  // orval/plain-text mismatch.
  http.post('*/v1/audit/annotations', async ({ request }) => {
    const body = (await request.json()) as AnnotateDecisionRequest;

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

    const response: AnnotateDecisionResponse = { created: !existing };

    return HttpResponse.json(response);
  }),

  // Answers POST /v1/audit/annotations/query (PACT-464/PACT-474). Not
  // offset-paginated -- returns every db.auditAnnotations row matching the
  // requested ids in one response, mirroring the real RPC's contract.
  http.post('*/v1/audit/annotations/query', async ({ request }) => {
    const body = (await request.json()) as ListDecisionAnnotationsRequest;
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
    const response: ListDecisionAnnotationsResponse = {
      annotations: db.auditAnnotations
        .getAll()
        .filter((annotation) => idSet.has(annotation.requestId)),
    };

    return HttpResponse.json(response);
  }),
];

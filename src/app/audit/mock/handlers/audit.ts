import { http, HttpResponse, type RequestHandler } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import { type AuditEvent } from '@/src/__codegen__/rest/audit';

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
];

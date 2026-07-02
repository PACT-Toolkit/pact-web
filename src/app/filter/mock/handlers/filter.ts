import { http, HttpResponse, type RequestHandler } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import { computeDecisionStats } from '@/src/app/filter/mock/data/filter';

export const handlers: RequestHandler[] = [
  http.get('*/v1/audit/events', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('topic') !== 'pact.decisions') return undefined;

    const requestId = url.searchParams.get('requestId');
    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
    const offset = Number(url.searchParams.get('offset') ?? '0');
    // Sort newest-first explicitly rather than relying on insertion order --
    // consensus.ts (PACT-369) appends a second batch of pact.decisions rows
    // via createConsensusMockData, so insertion order no longer coincides
    // with recency once both seeders have run.
    const all = db.decisions
      .getAll()
      .filter((event) => !requestId || event.requestId === requestId)
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    const page = all.slice(offset, offset + limit);

    return HttpResponse.json({ events: page, total: all.length });
  }),
  http.get('*/v1/audit/stats', ({ request }) => {
    const url = new URL(request.url);
    const sinceUnixParam = url.searchParams.get('sinceUnix');
    const untilUnixParam = url.searchParams.get('untilUnix');

    const stats = computeDecisionStats(db.decisions.getAll(), {
      sinceUnix: sinceUnixParam === null ? undefined : Number(sinceUnixParam),
      untilUnix: untilUnixParam === null ? undefined : Number(untilUnixParam),
    });

    return HttpResponse.json(stats);
  }),
];

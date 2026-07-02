import { http, HttpResponse, type RequestHandler } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import { computeDecisionStats } from '@/src/app/filter/mock/data/filter';

export const handlers: RequestHandler[] = [
  http.get('*/v1/audit/events', ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('topic') !== 'pact.decisions') return undefined;

    const limit = Math.min(Number(url.searchParams.get('limit') ?? '50'), 200);
    const offset = Number(url.searchParams.get('offset') ?? '0');
    const all = db.decisions.getAll();
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

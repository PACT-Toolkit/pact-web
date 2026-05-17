import { http, HttpResponse, type RequestHandler } from 'msw';

import { mockDecisionEvents } from '../data';

// Intercepts GET /v1/audit/events when topic=pact.decisions.
// Returning undefined passes through to the next handler so non-decisions
// topic queries are unaffected.
export const handlers: RequestHandler[] = [
  http.get('*/v1/audit/events', ({ request }) => {
    const url = new URL(request.url);

    if (url.searchParams.get('topic') !== 'pact.decisions') {
      return undefined;
    }

    const limitParam = url.searchParams.get('limit');
    const offsetParam = url.searchParams.get('offset');
    const limit = limitParam ? Math.min(Number(limitParam), 200) : 50;
    const offset = offsetParam ? Number(offsetParam) : 0;
    const page = mockDecisionEvents.slice(offset, offset + limit);

    return HttpResponse.json({
      events: page,
      total: mockDecisionEvents.length,
    });
  }),
];

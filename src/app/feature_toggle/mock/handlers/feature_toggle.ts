import { http, HttpResponse } from 'msw';

import { db } from '@/mocks/data/dbFactory';
import { MSW_PACT_BASE } from '@/src/framework/msw';

export const handlers = [
  http.get(`${MSW_PACT_BASE}/feature/features`, () =>
    HttpResponse.json(db.features.getAll())
  ),

  http.put(
    `${MSW_PACT_BASE}/feature/features/:id`,
    async ({ params, request }) => {
      const { id } = params as { id: string };
      const body = (await request.json()) as { isEnabled: boolean };

      const updated = db.features.update(
        (f) => f.id === id,
        (f) => ({ ...f, isEnabled: body.isEnabled })
      );

      if (!updated) {
        return HttpResponse.json(
          { error: 'feature not found' },
          { status: 404 }
        );
      }

      return HttpResponse.json(updated);
    }
  ),
];

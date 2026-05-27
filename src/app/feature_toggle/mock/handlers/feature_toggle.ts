import { http, HttpResponse } from 'msw';

import { db } from '@/mocks/data/dbFactory';

export const handlers = [
  http.get('*/api/pact/feature/features', () =>
    HttpResponse.json(db.features.getAll())
  ),

  http.put('*/api/pact/feature/features/:id', async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json()) as { isEnabled: boolean };

    const updated = db.features.update(
      (f) => f.id === id,
      (f) => ({ ...f, isEnabled: body.isEnabled })
    );

    if (!updated) {
      return HttpResponse.json({ error: 'feature not found' }, { status: 404 });
    }

    return HttpResponse.json(updated);
  }),
];

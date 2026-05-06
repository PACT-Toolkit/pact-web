import { http, HttpResponse } from 'msw';

import { type Feature } from '@/src/__codegen__/rest/feature/types';

import { mockFeatures } from '../data/features';

const featureStore: Feature[] = mockFeatures.map((f) => ({ ...f }));

export const handlers = [
  http.get('*/api/pact/feature/features', () =>
    HttpResponse.json(featureStore)
  ),

  http.put('*/api/pact/feature/features/:id', async ({ params, request }) => {
    const { id } = params as { id: string };
    const body = (await request.json()) as { isEnabled: boolean };
    const feature = featureStore.find((f) => f.id === id);

    if (!feature) {
      return HttpResponse.json({ error: 'feature not found' }, { status: 404 });
    }

    feature.isEnabled = body.isEnabled;

    return HttpResponse.json(feature);
  }),
];

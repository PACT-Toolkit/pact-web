import { type DB } from '@/mocks/data/dbFactory';
import { type Feature } from '@/src/__codegen__/rest/feature/types';

export const mockFeature = (overrides: Partial<Feature>): Feature => ({
  id: '',
  title: '',
  isEnabled: false,
  ...overrides,
});

export const createFeatureMockData = (db: DB): void => {
  db.features.create({ id: 'pact-benchmark-comparison', title: 'Benchmark Comparison' });
  db.features.create({ id: 'pact-audit-export', title: 'Audit Export' });
  db.features.create({ id: 'pact-policy-bulk-actions', title: 'Policy Bulk Actions' });
};

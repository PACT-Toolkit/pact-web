import {
  type AttackExample,
  createTestLabMockData,
  mockAttackExample,
} from '@/src/app/test_lab/mock/data';

import { MockRepository } from './repository';

export const db = {
  attackExamples: new MockRepository<AttackExample>(mockAttackExample),
};

export type DB = typeof db;

createTestLabMockData(db);

import {
  type Consent,
  type Preferences,
  type Profile,
} from '@/src/__codegen__/rest/account';
import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import {
  createAccountMockData,
  mockConsent,
  mockPreferences,
  mockProfile,
} from '@/src/app/account/mock/data/profile';
import {
  createFilterMockData,
  mockDecisionEvent,
} from '@/src/app/filter/mock/data/filter';
import {
  type AttackExample,
  type TestLabRunRecord,
  createTestLabMockData,
  createTestLabRunsMockData,
  mockAttackExample,
  mockTestLabRun,
} from '@/src/app/test_lab/mock/data/test_lab';

import { MockRepository } from './repository';

export const db = {
  accountProfile: new MockRepository<Profile>(mockProfile),
  accountPreferences: new MockRepository<Preferences>(mockPreferences),
  accountConsents: new MockRepository<Consent>(mockConsent),
  attackExamples: new MockRepository<AttackExample>(mockAttackExample),
  decisions: new MockRepository<AuditEvent>(mockDecisionEvent),
  testLabRuns: new MockRepository<TestLabRunRecord>(mockTestLabRun),
};

export type DB = typeof db;

createAccountMockData(db);
createFilterMockData(db);
createTestLabMockData(db);
createTestLabRunsMockData(db);

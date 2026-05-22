import {
  type Consent,
  type Preferences,
  type Profile,
} from '@/src/__codegen__/rest/account';
import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { type Feature } from '@/src/__codegen__/rest/feature/types';
import {
  createAccountMockData,
  mockConsent,
  mockPreferences,
  mockProfile,
} from '@/src/app/account/mock/data/profile';
import {
  createFeatureMockData,
  mockFeature,
} from '@/src/app/feature_toggle/mock/data/features';
import {
  createFilterMockData,
  mockDecisionEvent,
} from '@/src/app/filter/mock/data';
import {
  type AttackExample,
  createTestLabMockData,
  mockAttackExample,
} from '@/src/app/test_lab/mock/data';

import { MockRepository } from './repository';

export const db = {
  accountProfile: new MockRepository<Profile>(mockProfile),
  accountPreferences: new MockRepository<Preferences>(mockPreferences),
  accountConsents: new MockRepository<Consent>(mockConsent),
  attackExamples: new MockRepository<AttackExample>(mockAttackExample),
  decisions: new MockRepository<AuditEvent>(mockDecisionEvent),
  features: new MockRepository<Feature>(mockFeature),
};

export type DB = typeof db;

createAccountMockData(db);
createFeatureMockData(db);
createFilterMockData(db);
createTestLabMockData(db);

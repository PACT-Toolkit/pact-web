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
  createAuditMockData,
  mockAuditEvent,
} from '@/src/app/audit/mock/data/audit';
import { createConsensusMockData } from '@/src/app/consensus/mock/data/consensus';
import {
  createFilterMockData,
  mockDecisionEvent,
} from '@/src/app/filter/mock/data/filter';
import { createRedactorMockData } from '@/src/app/redactor/mock/data/redactor';
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
  auditAuthEvents: new MockRepository<AuditEvent>(mockAuditEvent),
  auditAccountEvents: new MockRepository<AuditEvent>(mockAuditEvent),
  auditFilesEvents: new MockRepository<AuditEvent>(mockAuditEvent),
  decisions: new MockRepository<AuditEvent>(mockDecisionEvent),
  testLabRuns: new MockRepository<TestLabRunRecord>(mockTestLabRun),
};

export type DB = typeof db;

createAccountMockData(db);
createAuditMockData(db);
createFilterMockData(db);
// Must run after createFilterMockData -- both seeders append rows to the
// shared db.decisions repository (see consensus.ts's header comment).
// Order doesn't affect correctness (the audit/filter handlers sort
// newest-first before slicing) but keeps the two decisions-producing
// seeders visually adjacent here.
createConsensusMockData(db);
// Third seeder appending to the shared db.decisions repository (PACT-324);
// see redactor.ts's header comment for its distinct offset scheme.
createRedactorMockData(db);
createTestLabMockData(db);
createTestLabRunsMockData(db);

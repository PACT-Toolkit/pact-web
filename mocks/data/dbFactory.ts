import {
  type Consent,
  type Preferences,
  type Profile,
} from '@/src/__codegen__/rest/account';
import {
  type AuditEvent,
  type DecisionAnnotation,
} from '@/src/__codegen__/rest/audit';
import { type ConfigConfigResponse } from '@/src/__codegen__/rest/config';
import { type FileRecord } from '@/src/__codegen__/rest/files';
import {
  createAccountMockData,
  mockConsent,
  mockPreferences,
  mockProfile,
} from '@/src/app/account/mock/data/profile';
import {
  createAuditMockData,
  createDecisionAnnotationsMockData,
  mockAuditEvent,
  mockDecisionAnnotation,
} from '@/src/app/audit/mock/data/audit';
import { createClassifierMockData } from '@/src/app/classifier/mock/data/classifier';
import { createConsensusMockData } from '@/src/app/consensus/mock/data/consensus';
import {
  createFilesMockData,
  mockFileRecord,
} from '@/src/app/files/mock/data/files';
import {
  createFilterMockData,
  mockDecisionEvent,
} from '@/src/app/filter/mock/data/filter';
import {
  createGatewayConfigMockData,
  mockGatewayConfig,
} from '@/src/app/gateway/mock/data/gateway';
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
  auditAnnotations: new MockRepository<DecisionAnnotation>(
    mockDecisionAnnotation
  ),
  auditAuthEvents: new MockRepository<AuditEvent>(mockAuditEvent),
  auditAccountEvents: new MockRepository<AuditEvent>(mockAuditEvent),
  auditFilesEvents: new MockRepository<AuditEvent>(mockAuditEvent),
  decisions: new MockRepository<AuditEvent>(mockDecisionEvent),
  files: new MockRepository<FileRecord>(mockFileRecord),
  gatewayConfig: new MockRepository<ConfigConfigResponse>(mockGatewayConfig),
  testLabRuns: new MockRepository<TestLabRunRecord>(mockTestLabRun),
};

export type DB = typeof db;

createAccountMockData(db);
createAuditMockData(db);
// No ordering dependency on the decisions-producing seeders below --
// annotations are independent rows keyed on requestId (PACT-464/PACT-474),
// looked up by whatever the caller passes, not tied to a decision row
// existing in db.decisions.
createDecisionAnnotationsMockData(db);
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
// Fourth seeder appending to the shared db.decisions repository (PACT-322);
// see classifier.ts's header comment for its distinct offset scheme.
createClassifierMockData(db);
createFilesMockData(db);
// No ordering dependency -- gatewayConfig is its own singleton entity, not
// part of the shared db.decisions repository the seeders above append to.
createGatewayConfigMockData(db);
createTestLabMockData(db);
createTestLabRunsMockData(db);

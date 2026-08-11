import {
  type AccountConsentResponse,
  type AccountPreferencesResponse,
  type AccountProfileResponse,
} from '@/src/__codegen__/rest/account';
import {
  type AuditAuditEventResponse,
  type AuditDecisionAnnotationResponse,
} from '@/src/__codegen__/rest/audit';
import {
  type AuthMfaFactorResponse,
  type AuthOAuthIdentityResponse,
  type AuthPasskeyResponse,
} from '@/src/__codegen__/rest/auth';
import { type ConfigConfigResponse } from '@/src/__codegen__/rest/config';
import { type FilesFileResponse } from '@/src/__codegen__/rest/files';
import {
  createAccountMockData,
  mockConsent,
  mockPreferences,
  mockProfile,
} from '@/src/app/account/mock/data/account';
import {
  createAuditMockData,
  createDecisionAnnotationsMockData,
  mockAuditEvent,
  mockDecisionAnnotation,
} from '@/src/app/audit/mock/data/audit';
import {
  type AuthRecoveryCodesState,
  createAuthMockData,
  mockAuthIdentity,
  mockAuthMfaFactor,
  mockAuthPasskey,
  mockAuthRecoveryCodesState,
} from '@/src/app/auth/mock/data/auth';
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
import { type PolicyEvent } from '@/src/app/policy/domain/policy_event';
import { type PolicyRule } from '@/src/app/policy/domain/policy_rule';
import {
  createPolicyEventsMockData,
  createPolicyRulesMockData,
  mockPolicyEvent,
  mockPolicyRule,
} from '@/src/app/policy/mock/data/policy';
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
  accountProfile: new MockRepository<AccountProfileResponse>(mockProfile),
  accountPreferences: new MockRepository<AccountPreferencesResponse>(
    mockPreferences
  ),
  accountConsents: new MockRepository<AccountConsentResponse>(mockConsent),
  attackExamples: new MockRepository<AttackExample>(mockAttackExample),
  auditAnnotations: new MockRepository<AuditDecisionAnnotationResponse>(
    mockDecisionAnnotation
  ),
  auditAuthEvents: new MockRepository<AuditAuditEventResponse>(mockAuditEvent),
  auditAccountEvents: new MockRepository<AuditAuditEventResponse>(
    mockAuditEvent
  ),
  auditFilesEvents: new MockRepository<AuditAuditEventResponse>(mockAuditEvent),
  authMfaFactors: new MockRepository<AuthMfaFactorResponse>(mockAuthMfaFactor),
  authPasskeys: new MockRepository<AuthPasskeyResponse>(mockAuthPasskey),
  authIdentities: new MockRepository<AuthOAuthIdentityResponse>(
    mockAuthIdentity
  ),
  authRecoveryCodesState: new MockRepository<AuthRecoveryCodesState>(
    mockAuthRecoveryCodesState
  ),
  decisions: new MockRepository<AuditAuditEventResponse>(mockDecisionEvent),
  files: new MockRepository<FilesFileResponse>(mockFileRecord),
  gatewayConfig: new MockRepository<ConfigConfigResponse>(mockGatewayConfig),
  policyEvents: new MockRepository<PolicyEvent>(mockPolicyEvent),
  policyRules: new MockRepository<PolicyRule>(mockPolicyRule),
  testLabRuns: new MockRepository<TestLabRunRecord>(mockTestLabRun),
};

export type DB = typeof db;

createAccountMockData(db);
createAuditMockData(db);
createAuthMockData(db);
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
createPolicyEventsMockData(db);
createPolicyRulesMockData(db);
createTestLabMockData(db);
createTestLabRunsMockData(db);

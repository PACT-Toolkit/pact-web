import { v4 as uuidv4 } from 'uuid';

import { type DB } from '@/mocks/data/dbFactory';
import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { type AccountPayload } from '@/src/app/audit/domain/audit_account_payload';
import { type AuthPayload } from '@/src/app/audit/domain/audit_auth_payload';
import { type FilesPayload } from '@/src/app/audit/domain/audit_files_payload';
import { MOCK_USER_ID } from '@/src/framework/helpers/environment';

// Fixtures for the three audit topics that have no dedicated feature seeder
// of their own -- pact.decisions is seeded by filter.ts and consensus.ts
// instead, since that payload is what the filter and consensus consoles
// both read. pact.policy is intentionally NOT seeded here: pact-audit
// doesn't consume that topic yet (PACT-306/308) and AuditWorkbench
// documents selecting it as an honest empty result, not a bug -- seeding it
// would contradict that documented behaviour.
export const mockAuditEvent = (overrides: Partial<AuditEvent>): AuditEvent => ({
  id: uuidv4(),
  topic: 'pact.auth',
  eventId: '',
  requestId: '',
  payloadJson: '',
  createdAt: new Date().toISOString(),
  ...overrides,
});

const buildAuthEvent = (
  offsetMs: number,
  requestId: string,
  payload: AuthPayload
): Partial<AuditEvent> => {
  const createdAt = new Date(Date.now() - offsetMs).toISOString();

  return {
    topic: 'pact.auth',
    eventId: payload.event_id ?? '',
    requestId,
    payloadJson: JSON.stringify({ ...payload, created_at: createdAt }),
    createdAt,
  };
};

const buildAccountEvent = (
  offsetMs: number,
  requestId: string,
  payload: AccountPayload
): Partial<AuditEvent> => {
  const createdAt = new Date(Date.now() - offsetMs).toISOString();

  return {
    topic: 'pact.account',
    eventId: payload.event_id ?? '',
    requestId,
    payloadJson: JSON.stringify({ ...payload, created_at: createdAt }),
    createdAt,
  };
};

const buildFilesEvent = (
  offsetMs: number,
  requestId: string,
  payload: FilesPayload
): Partial<AuditEvent> => {
  const createdAt = new Date(Date.now() - offsetMs).toISOString();

  return {
    topic: 'pact.files',
    // pact.files' row-level eventId mirrors the dedup UUID (payload.event_id)
    // rather than the semantic name -- event_type carries that instead, the
    // same asymmetry documented in audit_files_payload.ts.
    eventId: payload.event_id ?? '',
    requestId,
    payloadJson: JSON.stringify({ ...payload, created_at: createdAt }),
    createdAt,
  };
};

export const createAuditMockData = (db: DB): void => {
  const min = 60_000;
  const hour = 60 * min;

  const seedAuth = (
    offsetMs: number,
    requestId: string,
    payload: AuthPayload
  ) => {
    db.auditAuthEvents.create(buildAuthEvent(offsetMs, requestId, payload));
  };
  const seedAccount = (
    offsetMs: number,
    requestId: string,
    payload: AccountPayload
  ) => {
    db.auditAccountEvents.create(
      buildAccountEvent(offsetMs, requestId, payload)
    );
  };
  const seedFiles = (
    offsetMs: number,
    requestId: string,
    payload: FilesPayload
  ) => {
    db.auditFilesEvents.create(buildFilesEvent(offsetMs, requestId, payload));
  };

  // pact.auth -- covers every AUTH_EVENT_LABELS key at least once.
  seedAuth(3 * min, 'req-auth-a1', {
    event_id: 'login_started',
    user_id: MOCK_USER_ID,
    method: 'password',
  });
  seedAuth(3 * min - 5_000, 'req-auth-a1', {
    event_id: 'login_succeeded',
    user_id: MOCK_USER_ID,
    method: 'password',
    email: 'operator@pact.dev',
  });
  seedAuth(17 * min, 'req-auth-b2', {
    event_id: 'login_failed',
    method: 'password',
    email: 'unknown@pact.dev',
    ip: '203.0.113.44',
  });
  seedAuth(39 * min, 'req-auth-c3', {
    event_id: 'login_unverified',
    method: 'password',
    email: 'pending@pact.dev',
  });
  seedAuth(63 * min, 'req-auth-d4', {
    event_id: 'register_succeeded',
    user_id: MOCK_USER_ID,
    email: 'new-operator@pact.dev',
    display_name: 'New Operator',
  });
  seedAuth(63 * min - 30_000, 'req-auth-d4', {
    event_id: 'email_verification_requested',
    user_id: MOCK_USER_ID,
    email: 'new-operator@pact.dev',
  });
  seedAuth(78 * min, 'req-auth-e5', {
    event_id: 'email_verified',
    user_id: MOCK_USER_ID,
    email: 'new-operator@pact.dev',
  });
  seedAuth(2 * hour + 6 * min, 'req-auth-f6', {
    event_id: 'password_reset_requested',
    email: 'operator@pact.dev',
  });
  seedAuth(2 * hour + 5 * min, 'req-auth-f6', {
    event_id: 'password_set_link_requested',
    email: 'operator@pact.dev',
  });
  seedAuth(2 * hour + 4 * min, 'req-auth-f6', {
    event_id: 'password_changed',
    user_id: MOCK_USER_ID,
  });
  seedAuth(3 * hour + 7 * min, 'req-auth-g7', {
    event_id: 'login_succeeded',
    user_id: MOCK_USER_ID,
    method: 'passkey',
    provider: 'webauthn',
  });

  // pact.account -- covers every ACCOUNT_EVENT_LABELS key at least once.
  seedAccount(11 * min, 'req-acct-a1', {
    event_id: 'profile_updated',
    user_id: MOCK_USER_ID,
  });
  seedAccount(51 * min, 'req-acct-b2', {
    event_id: 'consent_recorded',
    user_id: MOCK_USER_ID,
    document: 'privacy-policy',
    version: '2026-01',
    granted: true,
  });
  seedAccount(71 * min, 'req-acct-c3', {
    event_id: 'consent_recorded',
    user_id: MOCK_USER_ID,
    document: 'marketing-emails',
    version: '2025-11',
    granted: false,
  });
  seedAccount(91 * min, 'req-acct-d4', {
    event_id: 'preferences_updated',
    user_id: MOCK_USER_ID,
  });
  seedAccount(2 * hour + 33 * min, 'req-acct-e5', {
    event_id: 'user_erasure_requested',
    user_id: MOCK_USER_ID,
  });

  // pact.files -- covers every FILES_EVENT_LABELS key at least once.
  seedFiles(7 * min, 'req-files-a1', {
    event_id: uuidv4(),
    event_type: 'file_ready',
    user_id: MOCK_USER_ID,
    file_id: uuidv4(),
    filename: 'incident-report.pdf',
    content_type: 'application/pdf',
    size_bytes: 482_311,
    purpose: 'evidence',
    status: 'ready',
  });
  seedFiles(61 * min, 'req-files-b2', {
    event_id: uuidv4(),
    event_type: 'file_rejected',
    user_id: MOCK_USER_ID,
    file_id: uuidv4(),
    filename: 'payload.exe',
    content_type: 'application/x-msdownload',
    purpose: 'evidence',
    status: 'rejected',
  });
  seedFiles(2 * hour + 47 * min, 'req-files-c3', {
    event_id: uuidv4(),
    event_type: 'file_deleted',
    user_id: MOCK_USER_ID,
    file_id: uuidv4(),
    filename: 'old-export.csv',
    purpose: 'export',
    status: 'deleted',
  });
};

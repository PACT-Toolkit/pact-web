import { describe, expect, it } from 'vitest';

import { db } from '@/mocks/data/dbFactory';
import {
  ACCOUNT_EVENT_LABELS,
  decodeAccountPayload,
} from '@/src/app/audit/domain/audit_account_payload';
import {
  AUTH_EVENT_LABELS,
  decodeAuthPayload,
} from '@/src/app/audit/domain/audit_auth_payload';
import {
  FILES_EVENT_LABELS,
  decodeFilesPayload,
} from '@/src/app/audit/domain/audit_files_payload';

// Drift guard for the hand-maintained *_EVENT_LABELS maps (PACT-369).
// These maps have no compile-time link to the Go producers whose event
// names they mirror -- a producer can add/rename/remove an event constant
// and nothing here would notice until an operator saw a raw event id
// fall back to itself in the UI. This is NOT codegen: it's a cheap
// tripwire pinning each map to a canonical, hand-copied event-name list.
//
// When a producer's event set changes, update BOTH the canonical list
// below AND the matching *_EVENT_LABELS map (and, ideally, the mock
// seeder in mock/data/audit.ts) in the same change.
//
// Canonical source of truth for each list:
//   AUTH:    pact-auth internal/kafka/producer.go     Evt* consts
//   ACCOUNT: pact-account internal/kafka/producer.go  Evt* consts
//   FILES:   pact-files internal/files/service.go     Event* consts
const CANONICAL_AUTH_EVENTS = [
  'login_started',
  'login_succeeded',
  'login_failed',
  'login_unverified',
  'register_succeeded',
  'email_verification_requested',
  'email_verified',
  'password_set_link_requested',
  'password_reset_requested',
  'password_changed',
];

const CANONICAL_ACCOUNT_EVENTS = [
  'user_erasure_requested',
  'consent_recorded',
  'profile_updated',
  'preferences_updated',
];

const CANONICAL_FILES_EVENTS = ['file_ready', 'file_rejected', 'file_deleted'];

describe('audit event-label drift guard', () => {
  it('AUTH_EVENT_LABELS covers exactly the canonical pact-auth event set', () => {
    expect(Object.keys(AUTH_EVENT_LABELS).sort()).toEqual(
      [...CANONICAL_AUTH_EVENTS].sort()
    );
  });

  it('ACCOUNT_EVENT_LABELS covers exactly the canonical pact-account event set', () => {
    expect(Object.keys(ACCOUNT_EVENT_LABELS).sort()).toEqual(
      [...CANONICAL_ACCOUNT_EVENTS].sort()
    );
  });

  it('FILES_EVENT_LABELS covers exactly the canonical pact-files event set', () => {
    expect(Object.keys(FILES_EVENT_LABELS).sort()).toEqual(
      [...CANONICAL_FILES_EVENTS].sort()
    );
  });

  // Second half of the tripwire: the mock seeder (mock/data/audit.ts) must
  // only ever emit event ids the label maps already recognise. This is
  // what would actually catch a typo or a stale name in the seeder itself,
  // independent of the canonical lists above.
  it('every seeded pact.auth event has a matching AUTH_EVENT_LABELS entry', () => {
    const unlabelled = db.auditAuthEvents
      .getAll()
      .map((event) => decodeAuthPayload(event.payloadJson)?.event_id)
      .filter((eventId): eventId is string => Boolean(eventId))
      .filter((eventId) => !(eventId in AUTH_EVENT_LABELS));

    expect(unlabelled).toEqual([]);
  });

  it('every seeded pact.account event has a matching ACCOUNT_EVENT_LABELS entry', () => {
    const unlabelled = db.auditAccountEvents
      .getAll()
      .map((event) => decodeAccountPayload(event.payloadJson)?.event_id)
      .filter((eventId): eventId is string => Boolean(eventId))
      .filter((eventId) => !(eventId in ACCOUNT_EVENT_LABELS));

    expect(unlabelled).toEqual([]);
  });

  it('every seeded pact.files event has a matching FILES_EVENT_LABELS entry', () => {
    const unlabelled = db.auditFilesEvents
      .getAll()
      .map((event) => decodeFilesPayload(event.payloadJson)?.event_type)
      .filter((eventType): eventType is string => Boolean(eventType))
      .filter((eventType) => !(eventType in FILES_EVENT_LABELS));

    expect(unlabelled).toEqual([]);
  });

  // Coverage in the other direction -- the seeder should exercise every
  // label at least once so /audit's dev:mock view is never missing a
  // topic's badge variety.
  it('the mock seeder exercises every AUTH_EVENT_LABELS key at least once', () => {
    const seeded = new Set(
      db.auditAuthEvents
        .getAll()
        .map((event) => decodeAuthPayload(event.payloadJson)?.event_id)
        .filter((eventId): eventId is string => Boolean(eventId))
    );

    expect(
      [...Object.keys(AUTH_EVENT_LABELS)].filter((k) => !seeded.has(k))
    ).toEqual([]);
  });

  it('the mock seeder exercises every ACCOUNT_EVENT_LABELS key at least once', () => {
    const seeded = new Set(
      db.auditAccountEvents
        .getAll()
        .map((event) => decodeAccountPayload(event.payloadJson)?.event_id)
        .filter((eventId): eventId is string => Boolean(eventId))
    );

    expect(
      [...Object.keys(ACCOUNT_EVENT_LABELS)].filter((k) => !seeded.has(k))
    ).toEqual([]);
  });

  it('the mock seeder exercises every FILES_EVENT_LABELS key at least once', () => {
    const seeded = new Set(
      db.auditFilesEvents
        .getAll()
        .map((event) => decodeFilesPayload(event.payloadJson)?.event_type)
        .filter((eventType): eventType is string => Boolean(eventType))
    );

    expect(
      [...Object.keys(FILES_EVENT_LABELS)].filter((k) => !seeded.has(k))
    ).toEqual([]);
  });
});

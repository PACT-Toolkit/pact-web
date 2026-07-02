import { describe, expect, it } from 'vitest';

import { type AuditEvent } from '@/src/__codegen__/rest/audit';
import { decodeAuditEventVariant } from '@/src/app/audit/domain/audit_event_variant';
import {
  localDateTimeToUnixSeconds,
  matchesActorFilter,
} from '@/src/app/audit/domain/audit_filters';

const baseEvent = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  id: 'evt-1',
  topic: 'pact.auth',
  eventId: 'login_succeeded',
  payloadJson: '{}',
  createdAt: '2026-06-12T14:00:00Z',
  ...overrides,
});

describe('matchesActorFilter', () => {
  it('matches on an empty query unconditionally', () => {
    const event = baseEvent();
    const variant = decodeAuditEventVariant(event.topic, event.payloadJson);
    expect(matchesActorFilter(event, variant, '')).toBe(true);
    expect(matchesActorFilter(event, variant, '   ')).toBe(true);
  });

  it('matches the row-level userId case-insensitively', () => {
    const event = baseEvent({ userId: 'User-123' });
    const variant = decodeAuditEventVariant(event.topic, event.payloadJson);
    expect(matchesActorFilter(event, variant, 'user-123')).toBe(true);
    expect(matchesActorFilter(event, variant, 'nope')).toBe(false);
  });

  it('matches on the email embedded in a pact.auth payload', () => {
    const event = baseEvent({
      payloadJson: JSON.stringify({ email: 'alice@example.com' }),
    });
    const variant = decodeAuditEventVariant(event.topic, event.payloadJson);
    expect(matchesActorFilter(event, variant, 'alice')).toBe(true);
  });

  it('does not match when no candidate contains the query', () => {
    const event = baseEvent({ userId: 'u-1' });
    const variant = decodeAuditEventVariant(event.topic, event.payloadJson);
    expect(matchesActorFilter(event, variant, 'u-2')).toBe(false);
  });

  it('never throws for an unknown-variant row with no userId', () => {
    const event = baseEvent({ topic: 'pact.policy', payloadJson: '{}' });
    const variant = decodeAuditEventVariant(event.topic, event.payloadJson);
    expect(() => matchesActorFilter(event, variant, 'anything')).not.toThrow();
    expect(matchesActorFilter(event, variant, 'anything')).toBe(false);
  });
});

describe('localDateTimeToUnixSeconds', () => {
  it('returns undefined for an empty string', () => {
    expect(localDateTimeToUnixSeconds('')).toBeUndefined();
  });

  it('returns undefined for an unparsable string', () => {
    expect(localDateTimeToUnixSeconds('not-a-date')).toBeUndefined();
  });

  it('converts a datetime-local value to unix seconds', () => {
    const seconds = localDateTimeToUnixSeconds('2026-06-12T14:00');
    expect(seconds).toBe(
      Math.floor(new Date('2026-06-12T14:00').getTime() / 1000)
    );
  });
});

import { describe, expect, it } from 'vitest';

import { type AuditAuditEventResponse } from '@/src/__codegen__/rest/audit';
import { decodeAuditEventVariant } from '@/src/app/audit/domain/audit_event_variant';
import {
  controlFilterParams,
  localDateTimeToUnixSeconds,
  matchesActorFilter,
  matchesControlFilter,
} from '@/src/app/audit/domain/audit_filters';
import { type DecisionPayload } from '@/src/lib/decisions/decision_payload';

const baseEvent = (
  overrides: Partial<AuditAuditEventResponse> = {}
): AuditAuditEventResponse => ({
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
    const variant = decodeAuditEventVariant(
      event.topic ?? '',
      event.payloadJson ?? ''
    );
    expect(matchesActorFilter(event, variant, '')).toBe(true);
    expect(matchesActorFilter(event, variant, '   ')).toBe(true);
  });

  it('matches the row-level userId case-insensitively', () => {
    const event = baseEvent({ userId: 'User-123' });
    const variant = decodeAuditEventVariant(
      event.topic ?? '',
      event.payloadJson ?? ''
    );
    expect(matchesActorFilter(event, variant, 'user-123')).toBe(true);
    expect(matchesActorFilter(event, variant, 'nope')).toBe(false);
  });

  it('matches on the email embedded in a pact.auth payload', () => {
    const event = baseEvent({
      payloadJson: JSON.stringify({ email: 'alice@example.com' }),
    });
    const variant = decodeAuditEventVariant(
      event.topic ?? '',
      event.payloadJson ?? ''
    );
    expect(matchesActorFilter(event, variant, 'alice')).toBe(true);
  });

  it('does not match when no candidate contains the query', () => {
    const event = baseEvent({ userId: 'u-1' });
    const variant = decodeAuditEventVariant(
      event.topic ?? '',
      event.payloadJson ?? ''
    );
    expect(matchesActorFilter(event, variant, 'u-2')).toBe(false);
  });

  it('never throws for an unknown-variant row with no userId', () => {
    const event = baseEvent({ topic: 'pact.policy', payloadJson: '{}' });
    const variant = decodeAuditEventVariant(
      event.topic ?? '',
      event.payloadJson ?? ''
    );
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

describe('controlFilterParams', () => {
  it('returns both params when framework and id are set, trimming the id', () => {
    expect(controlFilterParams('owasp_llm_top10', ' LLM01 ')).toEqual({
      controlFramework: 'owasp_llm_top10',
      controlId: 'LLM01',
    });
  });

  it('returns undefined when only one half or neither is set', () => {
    expect(controlFilterParams('owasp_llm_top10', '')).toBeUndefined();
    expect(controlFilterParams('', 'LLM01')).toBeUndefined();
    expect(controlFilterParams('', '  ')).toBeUndefined();
  });
});

describe('matchesControlFilter', () => {
  const payload: DecisionPayload = {
    filter: { controls: [{ framework: 'owasp_llm_top10', id: 'LLM01' }] },
    redactor: { controls: [{ framework: 'owasp_llm_top10', id: 'LLM02' }] },
  };

  it('matches a control carried by any stage sub-object', () => {
    expect(matchesControlFilter(payload, 'owasp_llm_top10', 'LLM01')).toBe(
      true
    );
    expect(matchesControlFilter(payload, 'owasp_llm_top10', 'LLM02')).toBe(
      true
    );
  });

  it('requires framework and id to match together', () => {
    expect(matchesControlFilter(payload, 'eu_ai_act_art15', 'LLM01')).toBe(
      false
    );
    expect(matchesControlFilter(payload, 'owasp_llm_top10', 'LLM06')).toBe(
      false
    );
    expect(matchesControlFilter({}, 'owasp_llm_top10', 'LLM01')).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { parseDecisionPayload } from '@/src/app/audit/domain/audit_decision_payload';

// Production-shaped sample of a pact.decisions event payload that the
// audit feed receives via /v1/audit/events. Mirrors the JSON pact-gateway's
// internal/kafka/producer.go emits when the redactor stage runs against
// content containing PII. Used as the source of truth for the audit
// row-expand contract — any change here must stay in lockstep with
// pact-gateway's DecisionEvent JSON shape.
const REDACTED_EMAIL_PAYLOAD = JSON.stringify({
  event_uuid: 'evt-abc',
  request_id: 'req-1',
  user_id: 'u-1',
  decision: 'allow',
  engine: 'redactor',
  redactor: {
    verdict: 'redacted',
    spans: [
      { start: 17, end: 38, label: 'EMAIL' },
      { start: 50, end: 66, label: 'CREDIT_CARD' },
    ],
  },
  latency_ms: 12,
  created_at: '2026-06-12T14:00:00Z',
});

describe('parseDecisionPayload — redactor.spans surface (PACT-231)', () => {
  it('exposes spans verbatim when verdict=redacted', () => {
    const dp = parseDecisionPayload(REDACTED_EMAIL_PAYLOAD);
    expect(dp?.redactor?.verdict).toBe('redacted');
    expect(dp?.redactor?.spans).toEqual([
      { start: 17, end: 38, label: 'EMAIL' },
      { start: 50, end: 66, label: 'CREDIT_CARD' },
    ]);
  });

  it('tolerates pre-PACT-231 payloads with no spans field', () => {
    // Older gateway builds (between PACT-249 W1 ship and this issue) emit
    // redactor.verdict without spans. The audit UI must not crash on those.
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-2',
        decision: 'allow',
        redactor: { verdict: 'redacted' },
      })
    );
    expect(dp?.redactor?.verdict).toBe('redacted');
    expect(dp?.redactor?.spans).toBeUndefined();
  });

  it('tolerates pass_through with no spans (the common case)', () => {
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-3',
        decision: 'allow',
        redactor: { verdict: 'pass_through' },
      })
    );
    expect(dp?.redactor?.verdict).toBe('pass_through');
    expect(dp?.redactor?.spans).toBeUndefined();
  });

  it('returns null on malformed JSON without throwing', () => {
    expect(parseDecisionPayload('{not-json')).toBeNull();
  });

  it('returns null when the payload is a JSON primitive or array', () => {
    expect(parseDecisionPayload('42')).toBeNull();
    expect(parseDecisionPayload('"hello"')).toBeNull();
    expect(parseDecisionPayload('[1,2,3]')).toBeNull();
  });
});

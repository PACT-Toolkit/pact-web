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

describe('parseDecisionPayload — consensus surface (PACT-263)', () => {
  // Production-shaped sample: classifier score below PACT_CONSENSUS_THRESHOLD,
  // gateway invoked pact-consensus as stage 2.5 (PACT-217), quorum reached.
  // Mirrors the JSONB observed during PACT-231 dev-stack verification.
  it('exposes consensus when quorum reached', () => {
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-4',
        decision: 'allow',
        engine: 'classifier',
        classifier: { label: 'benign' },
        consensus: {
          label: 'benign',
          quorum_reached: true,
          backend_count: 1,
        },
      })
    );
    expect(dp?.consensus).toEqual({
      label: 'benign',
      quorum_reached: true,
      backend_count: 1,
    });
  });

  it('exposes consensus skipped on transport fail-open', () => {
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-5',
        decision: 'allow',
        consensus: { skipped: true },
      })
    );
    expect(dp?.consensus?.skipped).toBe(true);
    expect(dp?.consensus?.label).toBeUndefined();
    expect(dp?.consensus?.quorum_reached).toBeUndefined();
  });

  it('exposes consensus without quorum (dissenting backends)', () => {
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-6',
        decision: 'allow',
        consensus: {
          label: 'benign',
          quorum_reached: false,
          backend_count: 3,
        },
      })
    );
    expect(dp?.consensus?.quorum_reached).toBe(false);
    expect(dp?.consensus?.backend_count).toBe(3);
  });

  it('tolerates pre-PACT-217 payloads with no consensus field', () => {
    // Classic two-stage decision: filter + classifier, no consensus.
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-7',
        decision: 'allow',
        engine: 'classifier',
        classifier: { label: 'benign' },
      })
    );
    expect(dp?.consensus).toBeUndefined();
  });
});

describe('parseDecisionPayload — forensic-trace surface (PACT-265)', () => {
  // Production-shaped sample: a full pipeline decision enriched with the
  // forensic-trace block the gateway stamps on every pact.decisions event.
  // Mirrors pact-gateway DecisionEvent — field names are frozen there.
  it('exposes the full forensic block when present', () => {
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-8',
        decision: 'block',
        engine: 'classifier',
        session_id: 'a'.repeat(64),
        client_ip: '203.0.113.7',
        user_agent: 'pact-sdk/1.2.3',
        conversation_id: 'conv-42',
        content: { sha256: 'b'.repeat(64), bytes: 26 },
      })
    );
    expect(dp?.session_id).toBe('a'.repeat(64));
    expect(dp?.client_ip).toBe('203.0.113.7');
    expect(dp?.user_agent).toBe('pact-sdk/1.2.3');
    expect(dp?.conversation_id).toBe('conv-42');
    expect(dp?.content).toEqual({ sha256: 'b'.repeat(64), bytes: 26 });
  });

  it('exposes the partial block on a pre-pipeline rejection', () => {
    // engine=gateway rejections carry ip/ua/conversation but never
    // session_id/content (body unread, identity not established).
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-9',
        decision: 'block',
        reason: 'auth_rejected',
        engine: 'gateway',
        client_ip: '198.51.100.9',
        user_agent: 'pact-sdk/9.9.9',
        conversation_id: 'conv-rejected',
      })
    );
    expect(dp?.client_ip).toBe('198.51.100.9');
    expect(dp?.conversation_id).toBe('conv-rejected');
    expect(dp?.session_id).toBeUndefined();
    expect(dp?.content).toBeUndefined();
  });

  it('tolerates pre-PACT-265 payloads with no forensic fields', () => {
    const dp = parseDecisionPayload(
      JSON.stringify({
        request_id: 'req-10',
        decision: 'allow',
        engine: 'classifier',
        classifier: { label: 'benign' },
      })
    );
    expect(dp?.session_id).toBeUndefined();
    expect(dp?.client_ip).toBeUndefined();
    expect(dp?.user_agent).toBeUndefined();
    expect(dp?.conversation_id).toBeUndefined();
    expect(dp?.content).toBeUndefined();
  });
});

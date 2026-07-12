import { describe, expect, it } from 'vitest';

import {
  AUDIT_TOPIC_OPTIONS,
  AUDIT_TOPIC_REGISTRY,
  decodeAuditEventVariant,
  prettyPayload,
} from '@/src/app/audit/domain/audit_event_variant';

describe('decodeAuditEventVariant', () => {
  it('decodes pact.decisions payloads', () => {
    const v = decodeAuditEventVariant(
      'pact.decisions',
      JSON.stringify({ decision: 'block', reason: 'filter_rule' })
    );
    expect(v.kind).toBe('decisions');
    if (v.kind === 'decisions') {
      expect(v.payload.decision).toBe('block');
    }
  });

  it('decodes pact.auth payloads', () => {
    const v = decodeAuditEventVariant(
      'pact.auth',
      JSON.stringify({ event_id: 'login_succeeded', method: 'password' })
    );
    expect(v.kind).toBe('auth');
    if (v.kind === 'auth') {
      expect(v.payload.event_id).toBe('login_succeeded');
    }
  });

  it('decodes pact.account payloads', () => {
    const v = decodeAuditEventVariant(
      'pact.account',
      JSON.stringify({ event_id: 'consent_recorded', granted: true })
    );
    expect(v.kind).toBe('account');
    if (v.kind === 'account') {
      expect(v.payload.granted).toBe(true);
    }
  });

  it('decodes pact.files payloads', () => {
    const v = decodeAuditEventVariant(
      'pact.files',
      JSON.stringify({ event_type: 'file_ready', filename: 'x.pdf' })
    );
    expect(v.kind).toBe('files');
    if (v.kind === 'files') {
      expect(v.payload.event_type).toBe('file_ready');
    }
  });

  it('falls back to unknown for pact.policy (not yet consumed, PACT-306/308)', () => {
    const v = decodeAuditEventVariant('pact.policy', '{"verdict":"allow"}');
    expect(v.kind).toBe('unknown');
    if (v.kind === 'unknown') {
      expect(v.raw).toBe('{"verdict":"allow"}');
    }
  });

  it('falls back to unknown for a completely unrecognised topic', () => {
    const v = decodeAuditEventVariant('pact.something_new', '{}');
    expect(v.kind).toBe('unknown');
  });

  it('falls back to unknown, never throws, on malformed JSON for a known topic', () => {
    expect(() =>
      decodeAuditEventVariant('pact.auth', '{not-json')
    ).not.toThrow();
    const v = decodeAuditEventVariant('pact.auth', '{not-json');
    expect(v.kind).toBe('unknown');
  });

  it('falls back to unknown on a JSON primitive payload', () => {
    const v = decodeAuditEventVariant('pact.files', '42');
    expect(v.kind).toBe('unknown');
  });
});

describe('AUDIT_TOPIC_REGISTRY', () => {
  it('decodes every registered topic to its matching variant kind', () => {
    // One representative payload per registered topic, exercising the
    // registry lookup path in decodeAuditEventVariant end to end (PACT-581)
    // rather than just the decoder in isolation.
    const samples: Record<keyof typeof AUDIT_TOPIC_REGISTRY, string> = {
      'pact.auth': JSON.stringify({ event_id: 'login_succeeded' }),
      'pact.account': JSON.stringify({ event_id: 'consent_recorded' }),
      'pact.files': JSON.stringify({ event_type: 'file_ready' }),
      'pact.decisions': JSON.stringify({ decision: 'allow' }),
    };

    for (const topic of Object.keys(AUDIT_TOPIC_REGISTRY) as Array<
      keyof typeof AUDIT_TOPIC_REGISTRY
    >) {
      const variant = decodeAuditEventVariant(topic, samples[topic]);
      expect(variant.kind).toBe(AUDIT_TOPIC_REGISTRY[topic].kind);
    }
  });
});

describe('AUDIT_TOPIC_OPTIONS', () => {
  it('preserves the exact pre-PACT-581 dropdown order and labels', () => {
    // Frozen expectation of AuditWorkbench's hand-written TOPIC_OPTIONS
    // before it was derived from AUDIT_TOPIC_REGISTRY -- guards against the
    // registry-driven dropdown silently reordering or relabeling.
    expect(AUDIT_TOPIC_OPTIONS).toEqual([
      { value: '', label: 'All topics' },
      { value: 'pact.auth', label: 'pact.auth (sign-in / passkey / MFA)' },
      {
        value: 'pact.account',
        label: 'pact.account (profile / consents / GDPR)',
      },
      { value: 'pact.files', label: 'pact.files (upload lifecycle)' },
      {
        value: 'pact.decisions',
        label: 'pact.decisions (allow / block calls)',
      },
      { value: 'pact.policy', label: 'pact.policy (not yet available)' },
    ]);
  });
});

describe('prettyPayload', () => {
  it('pretty-prints valid JSON', () => {
    expect(prettyPayload('{"a":1}')).toBe('{\n  "a": 1\n}');
  });

  it('falls back to the raw string on malformed JSON', () => {
    expect(prettyPayload('{not-json')).toBe('{not-json');
  });

  it('returns an empty string for an empty payload', () => {
    expect(prettyPayload('')).toBe('');
  });
});

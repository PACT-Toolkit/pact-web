import { describe, expect, it } from 'vitest';

import { decodeAccountPayload } from '@/src/app/audit/domain/audit_account_payload';
import { decodeAuthPayload } from '@/src/app/audit/domain/audit_auth_payload';
import { decodeFilesPayload } from '@/src/app/audit/domain/audit_files_payload';

describe('decodeAuthPayload', () => {
  it('decodes a login_succeeded event', () => {
    const p = decodeAuthPayload(
      JSON.stringify({
        event_id: 'login_succeeded',
        method: 'password',
        email: 'alice@example.com',
      })
    );
    expect(p?.event_id).toBe('login_succeeded');
    expect(p?.method).toBe('password');
  });

  it('returns null on malformed JSON without throwing', () => {
    expect(decodeAuthPayload('{not-json')).toBeNull();
  });

  it('returns null for a JSON primitive or array', () => {
    expect(decodeAuthPayload('1')).toBeNull();
    expect(decodeAuthPayload('[]')).toBeNull();
  });
});

describe('decodeAccountPayload', () => {
  it('decodes a consent_recorded event', () => {
    const p = decodeAccountPayload(
      JSON.stringify({
        event_id: 'consent_recorded',
        document: 'privacy_policy',
        version: '2026-01',
        granted: true,
      })
    );
    expect(p?.granted).toBe(true);
    expect(p?.document).toBe('privacy_policy');
  });

  it('returns null on malformed JSON without throwing', () => {
    expect(decodeAccountPayload('{not-json')).toBeNull();
  });
});

describe('decodeFilesPayload', () => {
  it('decodes a file_ready event keyed on event_type, not event_id', () => {
    const p = decodeFilesPayload(
      JSON.stringify({
        event_id: 'dedup-uuid-1',
        event_type: 'file_ready',
        filename: 'report.pdf',
        size_bytes: 2048,
      })
    );
    expect(p?.event_type).toBe('file_ready');
    expect(p?.event_id).toBe('dedup-uuid-1');
    expect(p?.size_bytes).toBe(2048);
  });

  it('returns null on malformed JSON without throwing', () => {
    expect(decodeFilesPayload('{not-json')).toBeNull();
  });
});

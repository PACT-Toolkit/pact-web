import { describe, expect, it } from 'vitest';

import { applyRedaction } from '@/src/app/redactor/domain/redactor_redaction';

describe('applyRedaction', () => {
  it('returns the content unchanged when there are no spans', () => {
    expect(applyRedaction('hello world', [])).toBe('hello world');
    expect(applyRedaction('hello world', undefined)).toBe('hello world');
  });

  it('masks a single span with its label', () => {
    const content = 'Contact me at jane@example.com today';
    const spans = [{ start: 14, end: 30, label: 'EMAIL' }];

    expect(applyRedaction(content, spans)).toBe(
      'Contact me at [REDACTED:EMAIL] today'
    );
  });

  it('masks multiple non-overlapping spans, sorted by position regardless of input order', () => {
    const content = 'PHONE:5551234567;EMAIL:a@b.com';
    // Deliberately out of position order -- applyRedaction must sort before
    // applying, not trust the caller's array order.
    const spans = [
      { start: 23, end: 30, label: 'EMAIL' },
      { start: 6, end: 16, label: 'PHONE' },
    ];

    expect(applyRedaction(content, spans)).toBe(
      'PHONE:[REDACTED:PHONE];EMAIL:[REDACTED:EMAIL]'
    );
  });

  it('falls back to a generic marker when a span has no label', () => {
    const content = 'secret: abc123';
    const spans = [{ start: 8, end: 14 }];

    expect(applyRedaction(content, spans)).toBe('secret: [REDACTED]');
  });

  it('skips a span that overlaps a previously-applied span', () => {
    const content = 'abcdefghij';
    const spans = [
      { start: 0, end: 5, label: 'A' },
      { start: 3, end: 8, label: 'B' },
    ];

    // Second span starts before the first span's end (cursor) -- skipped
    // defensively rather than producing corrupted/duplicated output.
    expect(applyRedaction(content, spans)).toBe('[REDACTED:A]fghij');
  });

  it('drops a malformed span (end <= start) without throwing', () => {
    const content = 'abcdefghij';
    const spans = [{ start: 5, end: 5, label: 'BAD' }];

    expect(() => applyRedaction(content, spans)).not.toThrow();
    expect(applyRedaction(content, spans)).toBe(content);
  });

  it('clamps an out-of-bounds span end to the content length', () => {
    const content = 'short';
    const spans = [{ start: 2, end: 999, label: 'X' }];

    expect(applyRedaction(content, spans)).toBe('sh[REDACTED:X]');
  });
});

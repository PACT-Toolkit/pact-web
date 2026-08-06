import { describe, expect, it } from 'vitest';

import { appendForwardedFor, inboundClientIp } from './client_ip';

describe('inboundClientIp', () => {
  it('resolves to the right-most X-Forwarded-For hop when present', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.5, 70.41.3.18',
    });

    expect(inboundClientIp(headers)).toBe('70.41.3.18');
  });

  it('trims whitespace around each hop before picking the right-most one', () => {
    const headers = new Headers({
      'x-forwarded-for': ' 203.0.113.5 ,  70.41.3.18 ',
    });

    expect(inboundClientIp(headers)).toBe('70.41.3.18');
  });

  it('falls back to X-Real-IP when X-Forwarded-For is absent', () => {
    const headers = new Headers({ 'x-real-ip': '198.51.100.9' });

    expect(inboundClientIp(headers)).toBe('198.51.100.9');
  });

  it('prefers X-Forwarded-For over X-Real-IP when both are present', () => {
    const headers = new Headers({
      'x-forwarded-for': '203.0.113.5',
      'x-real-ip': '198.51.100.9',
    });

    expect(inboundClientIp(headers)).toBe('203.0.113.5');
  });

  it('returns undefined when neither header is present', () => {
    expect(inboundClientIp(new Headers())).toBeUndefined();
  });
});

describe('appendForwardedFor', () => {
  it('appends the client IP after an existing value rather than replacing it', () => {
    expect(appendForwardedFor('203.0.113.5', '70.41.3.18')).toBe(
      '203.0.113.5, 70.41.3.18'
    );
  });

  it('returns the client IP alone when there is no existing value', () => {
    expect(appendForwardedFor(undefined, '70.41.3.18')).toBe('70.41.3.18');
    expect(appendForwardedFor(null, '70.41.3.18')).toBe('70.41.3.18');
  });

  it('returns the existing value unchanged when there is no client IP to append', () => {
    expect(appendForwardedFor('203.0.113.5', undefined)).toBe('203.0.113.5');
  });

  it('returns undefined when there is neither an existing value nor a client IP', () => {
    expect(appendForwardedFor(undefined, undefined)).toBeUndefined();
  });
});

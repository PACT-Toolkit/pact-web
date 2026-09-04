import { describe, expect, it } from 'vitest';

import { abbreviateHash } from '@/src/framework/format/abbreviate_hash';

describe('abbreviateHash', () => {
  it('truncates a 64-character digest to 8 characters by default', () => {
    const digest =
      'a1b2c3d4e5f60718293a4b5c6d7e8f9091a2b3c4d5e6f7081920a1b2c3d4e5f';
    expect(abbreviateHash(digest)).toBe('a1b2c3d4');
  });

  it('truncates to a custom length when given one', () => {
    expect(abbreviateHash('a1b2c3d4e5f6', 4)).toBe('a1b2');
  });

  it('returns the whole value unchanged when shorter than the length', () => {
    expect(abbreviateHash('short')).toBe('short');
  });

  it('returns an empty string for an empty value', () => {
    expect(abbreviateHash('')).toBe('');
  });
});

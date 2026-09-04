import { describe, expect, it } from 'vitest';

import { abbreviateHash } from '@/src/framework/format/abbreviate_hash';

describe('abbreviateHash', () => {
  it('truncates a 64-character hex digest to 8 characters by default', () => {
    const digest =
      'a1b2c3d4e5f60718293a4b5c6d7e8f9091a2b3c4d5e6f7081920a1b2c3d4e5f';
    expect(abbreviateHash(digest)).toBe('a1b2c3d4');
  });

  it('truncates a mixed-case hex digest', () => {
    const digest =
      'A1B2C3D4E5F60718293A4B5C6D7E8F9091A2B3C4D5E6F7081920A1B2C3D4E5F';
    expect(abbreviateHash(digest)).toBe('A1B2C3D4');
  });

  it('truncates to a custom length when given one', () => {
    expect(abbreviateHash('a1b2c3d4e5f6', 4)).toBe('a1b2');
  });

  it('returns a non-hex value like a version string unchanged, even when longer than the length', () => {
    expect(abbreviateHash('seed-v2.1')).toBe('seed-v2.1');
  });

  it('returns a short hex value unchanged when it is not longer than the length', () => {
    expect(abbreviateHash('abc123')).toBe('abc123');
  });

  it('returns the whole value unchanged when shorter than the length', () => {
    expect(abbreviateHash('short')).toBe('short');
  });

  it('returns an empty string for an empty value', () => {
    expect(abbreviateHash('')).toBe('');
  });
});

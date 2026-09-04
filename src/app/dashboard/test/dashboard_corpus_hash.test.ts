import { describe, expect, it } from 'vitest';

import { abbreviateCorpusHash } from '@/src/app/dashboard/domain/dashboard_corpus_hash';

describe('abbreviateCorpusHash', () => {
  it('truncates a 64-character digest to 8 characters', () => {
    const digest =
      'a1b2c3d4e5f60718293a4b5c6d7e8f9091a2b3c4d5e6f7081920a1b2c3d4e5f';
    expect(abbreviateCorpusHash(digest)).toBe('a1b2c3d4');
  });

  it('returns the whole value unchanged when shorter than the prefix', () => {
    expect(abbreviateCorpusHash('short')).toBe('short');
  });

  it('returns an empty string for an empty value', () => {
    expect(abbreviateCorpusHash('')).toBe('');
  });
});

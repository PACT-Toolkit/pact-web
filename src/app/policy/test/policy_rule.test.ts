import { describe, expect, it } from 'vitest';

import {
  type PolicyRule,
  parseScopes,
  sortRulesNewestFirst,
} from '@/src/app/policy/domain/policy_rule';

const rule = (id: string, createdAt: string): PolicyRule => ({
  id,
  name: id,
  status: 'draft',
  version: 1,
  createdAt,
  updatedAt: createdAt,
});

describe('parseScopes', () => {
  it('trims, drops empties, and dedupes', () => {
    expect(parseScopes('read, , write,')).toEqual(['read', 'write']);
    expect(parseScopes('read, read, write')).toEqual(['read', 'write']);
  });

  it('returns an empty array for blank input', () => {
    expect(parseScopes('')).toEqual([]);
    expect(parseScopes('   ')).toEqual([]);
  });
});

describe('sortRulesNewestFirst', () => {
  it('orders by createdAt descending', () => {
    const older = rule('older', '2026-06-10T00:00:00Z');
    const newer = rule('newer', '2026-06-12T00:00:00Z');
    const sorted = sortRulesNewestFirst([older, newer]);
    expect(sorted.map((r) => r.id)).toEqual(['newer', 'older']);
  });

  it('does not mutate the input array', () => {
    const input = [
      rule('a', '2026-06-10T00:00:00Z'),
      rule('b', '2026-06-12T00:00:00Z'),
    ];
    sortRulesNewestFirst(input);
    expect(input.map((r) => r.id)).toEqual(['a', 'b']);
  });
});

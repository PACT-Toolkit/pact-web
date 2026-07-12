import { describe, expect, it } from 'vitest';

import { type FilterLoadedPackResponse } from '@/src/__codegen__/rest/filter';
import {
  engineKindLabel,
  packSourceBadgeClass,
  packSourceLabel,
  sortPacksByLoadedAt,
} from '@/src/app/filter/domain/filter_packs';

describe('engineKindLabel', () => {
  it.each([
    ['regex', 'Regex'],
    ['vector', 'Vector'],
    ['literal', 'Literal'],
    ['something-else', 'Unknown'],
  ])('maps %s to %s', (engineKind, label) => {
    expect(engineKindLabel(engineKind)).toBe(label);
  });
});

describe('packSourceLabel', () => {
  it.each([
    ['built_in', 'Built-in'],
    ['policy_synced', 'Policy-synced'],
    ['something-else', 'Unknown'],
  ])('maps %s to %s', (source, label) => {
    expect(packSourceLabel(source)).toBe(label);
  });
});

describe('packSourceBadgeClass', () => {
  it('highlights policy-synced packs distinctly from built-in ones', () => {
    expect(packSourceBadgeClass('policy_synced')).toContain('blue');
    expect(packSourceBadgeClass('built_in')).not.toContain('blue');
  });
});

describe('sortPacksByLoadedAt', () => {
  const pack = (id: string, loadedAt: string): FilterLoadedPackResponse => ({
    id,
    name: id,
    source: 'built_in',
    engineKind: 'regex',
    loadedAt,
  });

  it('orders newest-loaded-first without mutating the input array', () => {
    const packs = [
      pack('a', '2026-01-01T00:00:00.000Z'),
      pack('b', '2026-01-03T00:00:00.000Z'),
      pack('c', '2026-01-02T00:00:00.000Z'),
    ];

    const sorted = sortPacksByLoadedAt(packs);

    expect(sorted.map((p) => p.id)).toEqual(['b', 'c', 'a']);
    expect(packs.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });
});

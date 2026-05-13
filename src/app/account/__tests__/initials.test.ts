import { describe, expect, it } from 'vitest';

import { computeInitials } from '../domain/initials';

describe('computeInitials', () => {
  describe('from displayName', () => {
    it('takes the first letter of the first two tokens', () => {
      expect(computeInitials('Ada Lovelace', 'ignored')).toBe('AL');
    });

    it('handles three or more tokens by ignoring the rest', () => {
      expect(computeInitials('Edsger W. Dijkstra', 'ignored')).toBe('EW');
    });

    it('takes two characters from a single-token name', () => {
      expect(computeInitials('Ada', 'ignored')).toBe('AD');
    });

    it('uppercases', () => {
      expect(computeInitials('ada lovelace', 'ignored')).toBe('AL');
    });

    it('strips diacritics so accented names degrade to ASCII', () => {
      // Combining marks (NFD) are stripped after normalisation.
      expect(computeInitials('Élon Müsk', 'ignored')).toBe('EM');
    });

    it('trims whitespace before splitting', () => {
      expect(computeInitials('  Ada  Lovelace  ', 'ignored')).toBe('AL');
    });

    it('falls through to userId when displayName is whitespace only', () => {
      expect(computeInitials('   ', 'abc-def')).toBe('AB');
    });

    it('falls through to userId when displayName is undefined', () => {
      expect(computeInitials(undefined, 'abc-def')).toBe('AB');
    });
  });

  describe('from userId', () => {
    it('takes the first two characters of a hyphen-stripped UUID', () => {
      expect(computeInitials(undefined, 'd9b4-1c5e')).toBe('D9');
    });

    it('upper-cases hex chars from the userId', () => {
      expect(computeInitials(undefined, 'a1b2c3')).toBe('A1');
    });
  });

  describe('fallback', () => {
    it('returns ? when both displayName and userId are missing', () => {
      expect(computeInitials(undefined, undefined)).toBe('?');
    });

    it('returns ? when both are empty strings', () => {
      expect(computeInitials('', '')).toBe('?');
    });

    it('returns ? when userId is only hyphens after stripping', () => {
      expect(computeInitials(undefined, '---')).toBe('?');
    });
  });
});

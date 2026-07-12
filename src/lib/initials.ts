// Initials render in the avatar fallback when the image hasn't loaded
// (or no avatar URL is set yet). Two characters max, uppercase, ASCII
// when possible -- keeps the visual stable in dense sidebar contexts.
//
// Resolution order:
//   1. First letters of the first two whitespace-separated tokens of
//      displayName ("Ada Lovelace" -> "AL"). Tokens are normalised to
//      handle accents (NFD strip + uppercase).
//   2. First two letters of a single-token displayName.
//   3. First two ASCII chars of the userId (UUID prefix). Last resort
//      so a brand-new account with no display name still has a stable,
//      identifiable avatar instead of a blank circle.
//   4. "?" if even the userId is empty (defensive -- shouldn't happen
//      in practice once the auth boundary is in place).
export const computeInitials = (
  displayName: string | undefined,
  userId: string | undefined
): string => {
  const fromName = initialsFromName(displayName);
  if (fromName) return fromName;

  const fromId = initialsFromId(userId);
  if (fromId) return fromId;

  return '?';
};

const initialsFromName = (name: string | undefined): string | null => {
  if (!name) return null;
  const trimmed = name.trim();
  if (!trimmed) return null;

  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 2) {
    return normalize(tokens[0][0] + tokens[1][0]);
  }

  // Single token -- take the first two characters so "Ada" -> "AD"
  // rather than just "A". Matches the visual weight of two-token
  // initials so the avatar doesn't look lopsided.
  return normalize(trimmed.slice(0, 2));
};

const initialsFromId = (id: string | undefined): string | null => {
  if (!id) return null;
  // UUIDs include hyphens; strip them so the first two chars are
  // hex characters, not punctuation.
  const compact = id.replace(/-/g, '');
  if (!compact) return null;

  return compact.slice(0, 2).toUpperCase();
};

// Strip combining marks (NFD decomposition) so accented characters
// fall back to their ASCII base, then upper-case. "Ëlon" -> "EL".
const normalize = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toUpperCase();

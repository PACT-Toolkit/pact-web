/** Default number of leading characters kept when abbreviating a hash. */
const DEFAULT_ABBREVIATED_LENGTH = 8;

/** Matches a hex digest: one or more hex digits, nothing else. */
const HEX_DIGEST_PATTERN = /^[0-9a-f]+$/i;

/**
 * Abbreviate a hex digest to its leading characters for display in a
 * compact UI element (a widget stat, a picker option). Only truncates
 * values that look like a hex digest (`/^[0-9a-f]+$/i`) and are longer
 * than `length` - a human-readable value like a version string ("seed-
 * v2.1") is returned unchanged, since cutting it mid-word loses meaning
 * rather than just shortening a hash. The full value should still be
 * surfaced elsewhere (e.g. via a `title` tooltip) so nothing is lost for
 * the values this does shorten.
 */
export function abbreviateHash(
  value: string,
  length: number = DEFAULT_ABBREVIATED_LENGTH
): string {
  if (value.length <= length || !HEX_DIGEST_PATTERN.test(value)) return value;

  return value.slice(0, length);
}

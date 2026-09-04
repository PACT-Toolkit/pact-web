/** Default number of leading characters kept when abbreviating a hash. */
const DEFAULT_ABBREVIATED_LENGTH = 8;

/**
 * Abbreviate a hash/digest/version string to its leading characters for
 * display in a compact UI element (a widget stat, a picker option). The
 * full value should still be surfaced elsewhere (e.g. via a `title`
 * tooltip) so nothing is lost - this only shortens what's rendered inline.
 */
export function abbreviateHash(
  value: string,
  length: number = DEFAULT_ABBREVIATED_LENGTH
): string {
  return value.slice(0, length);
}

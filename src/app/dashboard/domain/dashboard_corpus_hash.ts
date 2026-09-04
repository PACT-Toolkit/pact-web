/** Number of leading characters of a corpus hash shown in compact widgets. */
const CORPUS_HASH_PREFIX_LENGTH = 8;

/**
 * Abbreviate a corpus version/hash to its leading characters for display in
 * a widget. The full value should still be surfaced (e.g. via a `title`
 * tooltip) so nothing is lost - this only shortens what's rendered inline.
 */
export function abbreviateCorpusHash(value: string): string {
  return value.slice(0, CORPUS_HASH_PREFIX_LENGTH);
}

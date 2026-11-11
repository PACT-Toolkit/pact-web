/**
 * Cut `text` to at most `maxLength` characters, replacing the dropped tail
 * with a single "…" so the result never exceeds `maxLength`. Text that
 * already fits is returned unchanged. For compact UI slots (an axis tick)
 * where the full text is shown elsewhere, e.g. in a tooltip.
 */
export function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return '…'.slice(0, Math.max(0, maxLength));

  return `${text.slice(0, maxLength - 1)}…`;
}

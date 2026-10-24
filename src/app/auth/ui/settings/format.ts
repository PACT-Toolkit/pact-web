import { formatTimestamp } from '@/src/lib/format_timestamp';

// "Last used" formatter shared across the settings cards.

const relativeTimeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: 'auto',
});

// "Last used yesterday" / "Last used 3 days ago" / "Last used Jan 5, 2026".
// Switches to the absolute date once the relative phrasing stops being
// useful (≥ 1 week ago).
export const formatLastUsed = (when: Date | null): string => {
  if (!when) return 'Never used';
  const diffMs = when.getTime() - Date.now();
  const diffDays = Math.round(diffMs / 86_400_000);
  if (Math.abs(diffDays) < 7) {
    return `Last used ${relativeTimeFormatter.format(diffDays, 'day')}`;
  }

  return `Last used ${formatTimestamp(when, 'date')}`;
};

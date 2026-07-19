type TimestampVariant = 'full' | 'compact' | 'short';

const VARIANT_OPTIONS: Record<TimestampVariant, Intl.DateTimeFormatOptions> = {
  // e.g. "Nov 03, 2026, 14:07:33" -- audit rows and the decisions console
  // record cards, where the year matters for old rows.
  full: {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  },
  // e.g. "Nov 03, 14:07:33" -- dense live feeds where the year is noise.
  compact: {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  },
  // e.g. "Nov 03, 14:07" -- metadata lines where seconds add nothing.
  short: {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  },
};

// Renders an ISO timestamp in the viewer's locale, falling back to the raw
// string when it does not parse. The one timestamp formatter for every PACT
// list and card -- pick a variant instead of hand-rolling toLocaleString
// options per component.
export const formatTimestamp = (
  iso: string,
  variant: TimestampVariant = 'full'
): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;

  return d.toLocaleString(undefined, VARIANT_OPTIONS[variant]);
};

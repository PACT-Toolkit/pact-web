type TimestampVariant =
  'full' | 'compact' | 'short' | 'dateTime' | 'date' | 'time';

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
  // e.g. "Nov 3, 2026, 14:07" -- consent and audit-style records that need the
  // year but not the seconds.
  dateTime: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
  // e.g. "Nov 3, 2026" -- "added on" / "connected on" labels.
  date: {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  },
  // e.g. "2:07:33 PM" -- same-day activity lists.
  time: {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  },
};

// Renders an ISO string or a Date in the viewer's locale and time zone. An
// unparseable input falls back to the raw string ('' for an invalid Date). The
// one timestamp formatter for every PACT list and card -- pick a variant
// instead of hand-rolling toLocaleString options per component.
export const formatTimestamp = (
  input: string | Date,
  variant: TimestampVariant = 'full'
): string => {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return typeof input === 'string' ? input : '';

  return d.toLocaleString(undefined, VARIANT_OPTIONS[variant]);
};

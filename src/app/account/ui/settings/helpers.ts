// UI-local helpers for the /settings/account/* pages.
// Pure functions and constants only -- no React, no SWR.

// ── Consent document display ──────────────────────────────────────────────

export const DOCUMENT_LABELS: Record<string, string> = {
  terms_of_service: 'Terms of Service',
  privacy_policy: 'Privacy Policy',
  marketing_email: 'Marketing email opt-in',
};

// titleCase converts a snake_case slug to Title Case as a fallback
// for document slugs not found in DOCUMENT_LABELS. New document types
// added in pact-account will degrade gracefully without a UI deploy.
export const titleCase = (slug: string): string =>
  slug
    .split('_')
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : p))
    .join(' ');

// formatRecordedAt renders an RFC 3339 UTC string in the user's
// locale/timezone via Intl. Returns "" for unparseable input so the
// caller can omit the timestamp rather than showing "Invalid Date".
export const formatRecordedAt = (raw: string): string => {
  const d = new Date(raw);
  if (Number.isNaN(d.valueOf())) return '';

  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ── Erasure ───────────────────────────────────────────────────────────────

// The literal string the user must type to arm the erasure button.
// Kept constant (not localised) so the UX doesn't shift under
// internationalisation -- typing a fixed phrase signals intentionality
// regardless of the UI language.
export const ERASURE_CONFIRM = 'DELETE MY ACCOUNT';

// ── Export download ───────────────────────────────────────────────────────

// triggerDownload triggers a browser file download from an in-memory
// Blob. The URL is revoked on the next tick -- long enough for the
// browser to start the transfer before garbage-collecting the handle.
export const triggerDownload = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

// makeExportFilename stamps today's local date into the filename so
// repeated exports don't silently overwrite each other.
export const makeExportFilename = (): string => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `pact-account-export-${yyyy}-${mm}-${dd}.json`;
};

// ── Preferences toggles ───────────────────────────────────────────────────

export type ToggleKey = 'marketing_email' | 'product_email';

export type ToggleConfig = {
  field: 'marketingEmail' | 'productEmail';
  mask: ToggleKey;
  title: string;
  description: string;
};

export const TOGGLES: ToggleConfig[] = [
  {
    field: 'marketingEmail',
    mask: 'marketing_email',
    title: 'Marketing emails',
    description:
      'Product launches, customer stories, and the occasional promo. Off by default. Disabling here also revokes your stored marketing consent.',
  },
  {
    field: 'productEmail',
    mask: 'product_email',
    title: 'Product update emails',
    description:
      'Changelog entries and breaking-change notices. Recommended for active users.',
  },
];

import * as yup from 'yup';

// Mirror the proto field caps from pact-account/internal/account/service.go
// so the form fails fast and the user sees a per-field error before
// the round-trip. The server is still the source of truth -- a stale
// SPA will get a 400 from the gateway with `invalid request` and the
// onSubmit error handler surfaces it as a top-level alert.

// pact-account caps display_name at 128 chars (sufficient for unicode
// names and emoji-decorated handles; not a domain like "name length"
// problem). Trim leading/trailing whitespace so the submitted value
// is what the user sees -- pact-account does not strip on its side.
export const profileFormSchema = yup.object({
  displayName: yup
    .string()
    .trim()
    .max(128, 'Display name must be at most 128 characters')
    .defined(),
  avatarUrl: yup
    .string()
    .trim()
    // Empty is fine -- means "use the initials fallback".
    .test('absolute-url', 'Avatar URL must start with https://', (v) => {
      if (!v) return true;

      // Accept https only; http would warn-mixed-content under HTTPS
      // origins. Data URLs are tempting but pact-account never emits
      // them (they'd bloat the gRPC payload), so reject too.
      return /^https:\/\//i.test(v);
    })
    .max(2048, 'Avatar URL is too long')
    .defined(),
  locale: yup
    .string()
    .trim()
    .max(35, 'Locale must be a BCP 47 tag (e.g. en-US)')
    .defined(),
  timezone: yup
    .string()
    .trim()
    .max(64, 'Timezone must be an IANA name (e.g. Europe/Copenhagen)')
    .defined(),
  bio: yup
    .string()
    .trim()
    // pact-account caps bio at 2000 chars. Most users will write 1-2
    // sentences; the cap is for future template-heavy onboarding.
    .max(2000, 'Bio must be at most 2000 characters')
    .defined(),
});

export type ProfileFormData = yup.InferType<typeof profileFormSchema>;

// Mask name <-> form field mapping. The mask uses snake_case (proto),
// the form uses camelCase (TS). Keep this in one place so the form
// can compute the minimal mask without reaching for a string literal
// per field on every submit.
export const PROFILE_FIELD_TO_MASK: Record<keyof ProfileFormData, string> = {
  displayName: 'display_name',
  avatarUrl: 'avatar_url',
  locale: 'locale',
  timezone: 'timezone',
  bio: 'bio',
};

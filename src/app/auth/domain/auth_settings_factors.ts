import { type MfaFactor } from '@/src/app/auth/ui/settings/types';

// Single source of truth for "does this account have a verified TOTP
// factor" (PACT-723). A TOTP factor exists in the `factors` list from the
// moment `totp/enroll/begin` creates it - `verified` only flips to true
// once `totp/enroll/confirm` succeeds - so this intentionally excludes a
// pending-enrollment factor. Shared by AuthSettingsTwoFactorCard (decides
// whether to show the "Add authenticator app" button) and
// AuthSettingsSignInMethodsPanel (decides whether recovery-code generation
// is allowed, mirroring pact-auth's RegenerateRecoveryCodes step-up gate:
// HasVerifiedTOTPFactor-OR-HasVerifiedPasskey, PACT-707).
export const hasVerifiedTotpFactor = (factors: MfaFactor[]): boolean =>
  factors.some((f) => f.type.toLowerCase() === 'totp' && f.verified);

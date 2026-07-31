'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { hasVerifiedTotpFactor } from '@/src/app/auth/domain/auth_settings_factors';

import { AuthSettingsConnectedAccountsCard } from './AuthSettingsConnectedAccountsCard';
import { AuthSettingsPasskeysCard } from './AuthSettingsPasskeysCard';
import { AuthSettingsRecoveryCodesCard } from './AuthSettingsRecoveryCodesCard';
import { AuthSettingsTwoFactorCard } from './AuthSettingsTwoFactorCard';
import {
  type MfaFactor,
  type OAuthIdentitySummary,
  type Passkey,
} from './types';

type Props = {
  factors: MfaFactor[];
  passkeys: Passkey[];
  identities: OAuthIdentitySummary[];
};

export const AuthSettingsSignInMethodsPanel = ({
  factors,
  passkeys,
  identities,
}: Props) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const refresh = () => startTransition(() => router.refresh());

  // PACT-718 found that `canGenerate` used to count ANY TOTP factor,
  // including an unverified one still mid-enrollment (a factor started via
  // totp/enroll/begin exists, and is user-visible via
  // AuthSettingsTotpFactorRow's "pending verification" state, before its
  // enroll/confirm call sets `verified`). PACT-723 ruled that gate must
  // instead require a verified factor, mirroring pact-auth's
  // RegenerateRecoveryCodes step-up gate exactly: HasVerifiedTOTPFactor OR
  // HasVerifiedPasskey (PACT-707). `hasVerifiedTotpFactor` is the same
  // predicate AuthSettingsTwoFactorCard uses to decide whether to show the
  // "Add authenticator app" button - both consumers now share one
  // definition of "verified TOTP"
  // (src/app/auth/domain/auth_settings_factors.ts).
  // `passkeys` needs no separate verified check here: listPasskeys (see
  // src/framework/auth/pact_auth/factors.ts) only ever returns passkeys
  // pact-auth's ListPasskeys itself defines as "non-revoked, verified" -
  // passkey registration is atomic (FinishRegistration inserts the row
  // already marked verified), so there is no pending-passkey state to
  // exclude the way there is for TOTP.
  const hasVerifiedTotp = hasVerifiedTotpFactor(factors);
  const hasVerifiedPasskey = passkeys.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <AuthSettingsPasskeysCard passkeys={passkeys} onChanged={refresh} />
      <AuthSettingsConnectedAccountsCard
        identities={identities}
        onChanged={refresh}
      />
      <AuthSettingsTwoFactorCard factors={factors} onChanged={refresh} />
      <AuthSettingsRecoveryCodesCard
        canGenerate={hasVerifiedTotp || hasVerifiedPasskey}
      />
      {pending && (
        <span className="sr-only" aria-live="polite">
          Refreshing…
        </span>
      )}
    </div>
  );
};

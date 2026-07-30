'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

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

  // Counts any TOTP factor, verified or not - a factor started via
  // totp/enroll/begin exists (and is user-visible, see
  // AuthSettingsTotpFactorRow's "pending verification" state) before its
  // enroll/confirm call sets `verified`. This is a different predicate from
  // AuthSettingsTwoFactorCard's `hasVerifiedTotp`, which deliberately
  // requires `f.verified` to decide whether to show the "Add authenticator
  // app" button. Keep these two names distinct; do not unify them into one
  // flag without a behavior decision on whether an unverified TOTP factor
  // should count here too.
  const hasTotp = factors.some((f) => f.type.toLowerCase() === 'totp');
  const hasPasskey = passkeys.length > 0;

  return (
    <div className="flex flex-col gap-6">
      <AuthSettingsPasskeysCard passkeys={passkeys} onChanged={refresh} />
      <AuthSettingsConnectedAccountsCard
        identities={identities}
        onChanged={refresh}
      />
      <AuthSettingsTwoFactorCard factors={factors} onChanged={refresh} />
      <AuthSettingsRecoveryCodesCard canGenerate={hasTotp || hasPasskey} />
      {pending && (
        <span className="sr-only" aria-live="polite">
          Refreshing…
        </span>
      )}
    </div>
  );
};

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

  const hasTotp = factors.some((f) => f.type.toLowerCase() === 'totp');

  return (
    <div className="flex flex-col gap-6">
      <AuthSettingsPasskeysCard passkeys={passkeys} onChanged={refresh} />
      <AuthSettingsConnectedAccountsCard identities={identities} onChanged={refresh} />
      <AuthSettingsTwoFactorCard factors={factors} onChanged={refresh} />
      <AuthSettingsRecoveryCodesCard hasTotp={hasTotp} />
      {pending && (
        <span className="sr-only" aria-live="polite">
          Refreshing…
        </span>
      )}
    </div>
  );
};

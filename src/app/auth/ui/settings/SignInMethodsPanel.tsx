'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { ConnectedAccountsCard } from './ConnectedAccountsCard';
import { PasskeysCard } from './PasskeysCard';
import { RecoveryCodesCard } from './RecoveryCodesCard';
import { TwoFactorCard } from './TwoFactorCard';
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

export const SignInMethodsPanel = ({
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
      <PasskeysCard passkeys={passkeys} onChanged={refresh} />
      <ConnectedAccountsCard identities={identities} onChanged={refresh} />
      <TwoFactorCard factors={factors} onChanged={refresh} />
      <RecoveryCodesCard hasTotp={hasTotp} />
      {pending && (
        <span className="sr-only" aria-live="polite">
          Refreshing…
        </span>
      )}
    </div>
  );
};

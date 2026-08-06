import { render, screen } from '@testing-library/react';
import { type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { AuthSettingsSignInMethodsPanel } from '@/src/app/auth/ui/settings/AuthSettingsSignInMethodsPanel';
import { type MfaFactor, type Passkey } from '@/src/app/auth/ui/settings/types';

// AuthSettingsSignInMethodsPanel only calls router.refresh() from card
// onChanged callbacks, none of which fire on mount - a stub is enough to
// satisfy the `useRouter()` call, no navigation is exercised here.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const unverifiedTotpFactor: MfaFactor = {
  factorId: 'factor-1',
  type: 'totp',
  label: '',
  verified: false,
  createdAt: new Date('2026-07-01T00:00:00Z'),
};

const verifiedTotpFactor: MfaFactor = {
  ...unverifiedTotpFactor,
  factorId: 'factor-2',
  verified: true,
};

const passkey: Passkey = {
  passkeyId: 'passkey-1',
  label: 'MacBook Touch ID',
  createdAt: new Date('2026-07-01T00:00:00Z'),
  lastUsedAt: null,
};

const renderPanel = (factors: MfaFactor[], passkeys: Passkey[]) =>
  render(
    (
      <SWRTestProvider>
        <AuthSettingsSignInMethodsPanel
          factors={factors}
          passkeys={passkeys}
          identities={[]}
        />
      </SWRTestProvider>
    ) as ReactNode
  );

const recoveryCodesButton = () =>
  screen.getByRole('button', { name: /generate recovery codes/i });

describe('AuthSettingsSignInMethodsPanel', () => {
  // PACT-718 / PACT-723: an unverified, pending-enrollment TOTP factor
  // (created by totp/enroll/begin, before enroll/confirm) must not unlock
  // recovery-code generation - mirrors pact-auth's RegenerateRecoveryCodes
  // gate, which checks HasVerifiedTOTPFactor, not "any TOTP row exists".
  it('disables recovery-code generation for an unverified-TOTP-only account', () => {
    renderPanel([unverifiedTotpFactor], []);

    expect(recoveryCodesButton()).toBeDisabled();
  });

  it('enables recovery-code generation once the TOTP factor is verified', () => {
    renderPanel([verifiedTotpFactor], []);

    expect(recoveryCodesButton()).toBeEnabled();
  });

  it('enables recovery-code generation for a passkey-only account', () => {
    renderPanel([], [passkey]);

    expect(recoveryCodesButton()).toBeEnabled();
  });

  it('disables recovery-code generation when the account has no factors at all', () => {
    renderPanel([], []);

    expect(recoveryCodesButton()).toBeDisabled();
  });
});

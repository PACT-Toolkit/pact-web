import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { AuthSettingsRecoveryCodesCard } from '@/src/app/auth/ui/settings/AuthSettingsRecoveryCodesCard';

const renderCard = (canGenerate: boolean) =>
  render(
    (
      <SWRTestProvider>
        <AuthSettingsRecoveryCodesCard canGenerate={canGenerate} />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('AuthSettingsRecoveryCodesCard', () => {
  // PACT-714: this gate used to be TOTP-only. A passkey now qualifies too
  // (pact-auth accepts a passkey step-up for RegenerateRecoveryCodes), so
  // the card takes a pre-computed `canGenerate` instead of deciding for
  // itself which factor types count.
  it('disables the button and explains why when the account has no qualifying factor', () => {
    renderCard(false);

    expect(
      screen.getByRole('button', { name: /generate recovery codes/i })
    ).toBeDisabled();
    expect(
      screen.getByText(/add a passkey or an authenticator app/i)
    ).toBeInTheDocument();
  });

  it('enables the button for a passkey-only account (no TOTP required)', () => {
    renderCard(true);

    expect(
      screen.getByRole('button', { name: /generate recovery codes/i })
    ).toBeEnabled();
    expect(
      screen.queryByText(/add a passkey or an authenticator app/i)
    ).not.toBeInTheDocument();
  });

  it('shows the generated codes once, with the regenerate label on a second round', async () => {
    server.use(
      http.post('*/api/auth/mfa/recovery-codes', () =>
        HttpResponse.json({ recoveryCodes: ['aaa111', 'bbb222'] })
      )
    );

    renderCard(true);
    fireEvent.click(
      screen.getByRole('button', { name: /generate recovery codes/i })
    );

    await waitFor(() =>
      expect(screen.getByTestId('settings-recovery-codes')).toHaveTextContent(
        'aaa111'
      )
    );
    expect(
      screen.getByRole('button', { name: /regenerate codes/i })
    ).toBeInTheDocument();
  });
});

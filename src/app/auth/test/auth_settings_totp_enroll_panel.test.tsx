import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';

import { server } from '@/mocks/server';
import { SWRTestProvider } from '@/mocks/swr_test_provider';
import { AuthSettingsTotpEnrollPanel } from '@/src/app/auth/ui/settings/AuthSettingsTotpEnrollPanel';
import { TOTP_QR_TEST_ID } from '@/src/app/auth/ui/settings/AuthSettingsTotpEnrollQrCode';
import { QrCodeTile } from '@/src/framework/qr';

const MOCK_SECRET = 'MOCKSECRETMOCKSECRETMOCK';
const MOCK_OTPAUTH_URL = `otpauth://totp/PACT:mock-user?secret=${MOCK_SECRET}&issuer=PACT`;

const renderPanel = () =>
  render(
    (
      <SWRTestProvider>
        <AuthSettingsTotpEnrollPanel
          onComplete={() => {}}
          onCancel={() => {}}
        />
      </SWRTestProvider>
    ) as ReactNode
  );

describe('AuthSettingsTotpEnrollPanel', () => {
  it('renders a scannable QR code plus the secret and its copy fallback once setup begins', async () => {
    // AuthSettingsTotpEnrollPanel calls the Next.js route handler directly
    // (/api/auth/mfa/enroll/begin), not the pact-gateway path the route
    // handler forwards to server-side - there is no live Next server in
    // this test, so the client-facing boundary is mocked here instead of
    // relying on the default handlers (which only cover the gateway hop).
    server.use(
      http.post('*/api/auth/mfa/enroll/begin', () =>
        HttpResponse.json({
          factorId: 'factor-1',
          secret: MOCK_SECRET,
          otpauthUrl: MOCK_OTPAUTH_URL,
        })
      )
    );

    renderPanel();

    fireEvent.click(screen.getByTestId('totp-begin'));

    await waitFor(() =>
      expect(screen.getByTestId('totp-enroll-panel').dataset.stage).toBe(
        'verify'
      )
    );

    // QR code: rendered client-side, on its own white tile, encoding
    // exactly the otpauth URI the begin call returned - compared against
    // a direct QrCodeTile render of that same value (see
    // AuthSettingsTotpEnrollQrCode, which composes QrCodeTile with the
    // totp-qr-code test id and an accessible title).
    const qrTile = screen.getByTestId(TOTP_QR_TEST_ID);
    const { container: reference } = render(
      <QrCodeTile
        value={MOCK_OTPAUTH_URL}
        testId={TOTP_QR_TEST_ID}
        title="Authenticator app setup QR code"
      />
    );
    expect(qrTile.querySelector('svg')?.outerHTML).toBe(
      reference.querySelector('svg')?.outerHTML
    );

    // Secret + copy fallback for manual entry are still present.
    expect(screen.getByTestId('totp-secret')).toHaveTextContent(MOCK_SECRET);
    expect(
      screen.getByRole('button', { name: 'Copy authenticator secret' })
    ).toBeInTheDocument();

    // The otpauth URI stays available to screen-reader users and to the
    // Playwright enrollment specs (e2e/mfa-totp.spec.ts,
    // e2e/password-reset-mfa.spec.ts), which compute a real TOTP code from
    // it - it's just no longer rendered as visible clutter now the QR
    // covers that purpose for sighted users.
    const otpauthUrlEl = screen.getByTestId('totp-otpauth-url');
    expect(otpauthUrlEl).toHaveClass('sr-only');
    expect(otpauthUrlEl).toHaveTextContent(MOCK_OTPAUTH_URL);
  });
});

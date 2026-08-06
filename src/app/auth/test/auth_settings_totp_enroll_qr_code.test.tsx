import { render, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AuthSettingsTotpEnrollQrCode,
  TOTP_QR_TEST_ID,
} from '@/src/app/auth/ui/settings/AuthSettingsTotpEnrollQrCode';
import { QrCodeTile } from '@/src/framework/qr';

const OTPAUTH_URL =
  'otpauth://totp/PACT:mock-user?secret=MOCKSECRETMOCKSECRETMOCK&issuer=PACT';

// AuthSettingsTotpEnrollQrCode is a thin TOTP-specific composition over the
// shared QrCodeTile (src/framework/qr) - the QR rendering itself is tested
// there. This just pins the wiring: the right test id, an accessible
// title, and the otpauth URI passed through unchanged.
describe('AuthSettingsTotpEnrollQrCode', () => {
  it('renders under the totp-qr-code test id with an accessible title', () => {
    const { container } = render(
      <AuthSettingsTotpEnrollQrCode value={OTPAUTH_URL} />
    );

    const tile = within(container).getByTestId(TOTP_QR_TEST_ID);
    expect(tile.querySelector('svg')).not.toBeNull();
    expect(tile.querySelector('title')?.textContent).toBe(
      'Authenticator app setup QR code'
    );
  });

  it('passes the otpauth URI through to QrCodeTile unchanged', () => {
    const { container } = render(
      <AuthSettingsTotpEnrollQrCode value={OTPAUTH_URL} />
    );
    const rendered = within(container)
      .getByTestId(TOTP_QR_TEST_ID)
      .querySelector('svg');

    const { container: reference } = render(
      <QrCodeTile
        value={OTPAUTH_URL}
        testId={TOTP_QR_TEST_ID}
        title="Authenticator app setup QR code"
      />
    );
    const expected = within(reference)
      .getByTestId(TOTP_QR_TEST_ID)
      .querySelector('svg');

    expect(rendered?.outerHTML).toBe(expected?.outerHTML);
  });
});

'use client';

import { QrCodeTile } from '@/src/framework/qr';

type Props = {
  value: string;
};

export const TOTP_QR_TEST_ID = 'totp-qr-code';
const TOTP_QR_TITLE = 'Authenticator app setup QR code';

/**
 * Renders the otpauth:// enrollment URI as a scannable QR code, on the
 * shared QrCodeTile presentation - the TOTP-specific piece is just the
 * test id and accessible title, not the QR rendering itself.
 */
export const AuthSettingsTotpEnrollQrCode = ({ value }: Props) => (
  <QrCodeTile value={value} testId={TOTP_QR_TEST_ID} title={TOTP_QR_TITLE} />
);

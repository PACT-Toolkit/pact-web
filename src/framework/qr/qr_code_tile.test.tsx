import { render, within } from '@testing-library/react';
import { QRCodeSVG } from 'qrcode.react';
import { describe, expect, it } from 'vitest';

import { QrCodeTile } from '@/src/framework/qr/qr_code_tile';

const VALUE = 'otpauth://totp/PACT:mock-user?secret=MOCKSECRET&issuer=PACT';

describe('QrCodeTile', () => {
  it('renders a QR code on a white, padded, rounded tile', () => {
    const { container } = render(<QrCodeTile value={VALUE} testId="qr-tile" />);

    const tile = within(container).getByTestId('qr-tile');
    expect(tile).toHaveClass('bg-white', 'rounded-lg', 'p-4');
    expect(tile.querySelector('svg')).not.toBeNull();
  });

  it('encodes exactly the given value - matches a direct QRCodeSVG render with the same defaults', () => {
    const { container } = render(<QrCodeTile value={VALUE} testId="qr-tile" />);
    const rendered = within(container)
      .getByTestId('qr-tile')
      .querySelector('svg');

    // QrCodeTile's default size/level (168 / 'M'). Byte-identical markup
    // proves it threads `value` into the encoder unchanged.
    const { container: reference } = render(
      <QRCodeSVG value={VALUE} size={168} level="M" />
    );
    const expected = reference.querySelector('svg');

    expect(rendered?.outerHTML).toBe(expected?.outerHTML);
  });

  it('produces different markup for a different value', () => {
    const { container: containerA } = render(
      <QrCodeTile value={VALUE} testId="qr-tile" />
    );
    const { container: containerB } = render(
      <QrCodeTile
        value="otpauth://totp/PACT:other-user?secret=DIFFERENTSECRET&issuer=PACT"
        testId="qr-tile"
      />
    );

    const a = within(containerA).getByTestId('qr-tile').querySelector('svg');
    const b = within(containerB).getByTestId('qr-tile').querySelector('svg');

    expect(a?.outerHTML).not.toBe(b?.outerHTML);
  });

  it('forwards an accessible title onto the underlying QR code', () => {
    const { container } = render(
      <QrCodeTile value={VALUE} testId="qr-tile" title="Setup QR code" />
    );

    const titleEl = within(container)
      .getByTestId('qr-tile')
      .querySelector('title');
    expect(titleEl?.textContent).toBe('Setup QR code');
  });
});

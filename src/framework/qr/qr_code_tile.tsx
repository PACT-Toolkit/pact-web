'use client';

import { QRCodeSVG } from 'qrcode.react';

import { cn } from '@/src/lib/utils';

type Props = {
  value: string;
  size?: number;
  level?: 'L' | 'M' | 'Q' | 'H';
  title?: string;
  testId?: string;
  className?: string;
};

/**
 * Renders an arbitrary string as a scannable QR code, encoded entirely
 * client-side (no network request, no third-party image service - the
 * value never leaves the page). Sits on a white, rounded, padded tile so
 * it scans reliably against a dark theme: a QR code needs a light quiet
 * zone around it, which a dark surface doesn't provide on its own.
 *
 * The quiet zone itself is drawn by `QRCodeSVG` via `marginSize` (in QR
 * modules, per the spec's 4-module minimum), not by the tile's CSS
 * padding alone - `qrcode.react` defaults `marginSize` to 0, and a
 * fixed-pixel padding shrinks in module terms as `value` grows and the
 * library steps up to a higher QR version with smaller modules. The tile
 * padding (`p-4`) is purely cosmetic breathing room on top of that.
 *
 * Generic and feature-agnostic - callers own what `value` means (an
 * otpauth:// URI, a share link, ...) and any feature-specific labelling
 * (test ids, titles) via props.
 */
export const QrCodeTile = ({
  value,
  size = 168,
  level = 'M',
  title,
  testId,
  className,
}: Props) => (
  <div className={cn('flex justify-center', className)}>
    <div data-testid={testId} className="rounded-lg bg-white p-4 shadow-sm">
      <QRCodeSVG
        value={value}
        size={size}
        level={level}
        title={title}
        marginSize={4}
      />
    </div>
  </div>
);

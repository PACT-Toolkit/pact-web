import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthPasskeyEnrollmentBanner } from '@/src/app/auth/ui/passkey/AuthPasskeyEnrollmentBanner';

// The banner is the single passkey prompt in the app shell. Its visibility
// rule is: the browser supports WebAuthn, the account has no passkey (server
// flag), and the user has not dismissed or enrolled on this device (local
// storage). The real webauthn module runs here; only the browser API and
// storage are stubbed.
const DISMISSED_KEY = 'pact:passkey-prompt-dismissed';

const stubWebAuthn = () => {
  vi.stubGlobal('PublicKeyCredential', function PublicKeyCredential() {});
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create: vi.fn(), get: vi.fn() },
  });
};

const bannerRegion = () =>
  screen.queryByRole('region', { name: 'Passkey enrollment' });

describe('AuthPasskeyEnrollmentBanner visibility', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubWebAuthn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it('shows when the account has no passkey and nothing is dismissed', () => {
    render(<AuthPasskeyEnrollmentBanner />);

    expect(bannerRegion()).toBeInTheDocument();
    expect(
      screen.getByText('Add a passkey for faster, phishing-resistant sign in')
    ).toBeInTheDocument();
  });

  it('is hidden when the account already has a passkey', () => {
    render(<AuthPasskeyEnrollmentBanner hasPasskeyOrWebauthnMfa />);

    expect(bannerRegion()).not.toBeInTheDocument();
  });

  it('is hidden when it was dismissed on this device', () => {
    window.localStorage.setItem(DISMISSED_KEY, '1');

    render(<AuthPasskeyEnrollmentBanner />);

    expect(bannerRegion()).not.toBeInTheDocument();
  });

  it('is hidden when a passkey was enrolled locally', () => {
    window.localStorage.setItem('pact:has-passkey', '1');

    render(<AuthPasskeyEnrollmentBanner />);

    expect(bannerRegion()).not.toBeInTheDocument();
  });

  it('persists the dismissal and hides itself', () => {
    render(<AuthPasskeyEnrollmentBanner />);

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    });

    expect(bannerRegion()).not.toBeInTheDocument();
    expect(window.localStorage.getItem(DISMISSED_KEY)).toBe('1');
  });
});

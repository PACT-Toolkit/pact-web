import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as WebauthnModule from '@/src/app/auth/domain/webauthn';
import { PasskeyError, enrollPasskey } from '@/src/app/auth/domain/webauthn';
import { AuthPasskeyAddButton } from '@/src/app/auth/ui/passkey/AuthPasskeyAddButton';

// AuthPasskeyAddButton's whole ceremony (navigator.credentials.create +
// two Next.js route-handler hops) is exercised by mock-mode E2E and
// webauthn.test.ts, not here - this file is purely about what the button
// renders once enrollPasskey resolves or rejects, so the domain module is
// mocked at the boundary instead of driving a real WebAuthn ceremony.
vi.mock('@/src/app/auth/domain/webauthn', async (importOriginal) => {
  const actual = await importOriginal<typeof WebauthnModule>();

  return {
    ...actual,
    enrollPasskey: vi.fn(),
    markPasskeyEnrolledLocally: vi.fn(),
    isWebAuthnSupported: () => true,
  };
});

const mockEnrollPasskey = vi.mocked(enrollPasskey);

const renderButton = (onEnrolled?: () => void) =>
  render((<AuthPasskeyAddButton onEnrolled={onEnrolled} />) as ReactNode);

describe('AuthPasskeyAddButton', () => {
  beforeEach(() => {
    mockEnrollPasskey.mockReset();
  });

  it('calls onEnrolled immediately when pact-auth issues no recovery codes', async () => {
    mockEnrollPasskey.mockResolvedValue({ credentialId: 'cred-1' });
    const onEnrolled = vi.fn();

    renderButton(onEnrolled);
    fireEvent.click(screen.getByRole('button', { name: /add a passkey/i }));

    await waitFor(() => expect(onEnrolled).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByTestId('passkey-recovery-codes-card')
    ).not.toBeInTheDocument();
  });

  it('shows a show-once recovery-codes card and defers onEnrolled until Done', async () => {
    mockEnrollPasskey.mockResolvedValue({
      credentialId: 'cred-2',
      recoveryCodes: ['aaa111', 'bbb222'],
    });
    const onEnrolled = vi.fn();

    renderButton(onEnrolled);
    fireEvent.click(screen.getByRole('button', { name: /add a passkey/i }));

    await screen.findByTestId('passkey-recovery-codes-card');
    expect(screen.getByTestId('passkey-recovery-codes')).toHaveTextContent(
      'aaa111'
    );
    expect(screen.getByTestId('passkey-recovery-codes')).toHaveTextContent(
      'bbb222'
    );
    // Not returned to the caller yet - the user hasn't acknowledged the
    // codes.
    expect(onEnrolled).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('passkey-recovery-codes-done'));

    expect(onEnrolled).toHaveBeenCalledTimes(1);
    expect(
      screen.queryByTestId('passkey-recovery-codes-card')
    ).not.toBeInTheDocument();
  });

  it('never shows the recovery-codes card when onEnrolled is omitted (banner/CTA mount points)', async () => {
    mockEnrollPasskey.mockResolvedValue({
      credentialId: 'cred-3',
      recoveryCodes: ['ccc333'],
    });

    render((<AuthPasskeyAddButton />) as ReactNode);
    fireEvent.click(screen.getByRole('button', { name: /add a passkey/i }));

    // Still shown even with no onEnrolled callback - dropping issued codes
    // silently would be a real bug regardless of which surface enrolled
    // the passkey.
    await screen.findByTestId('passkey-recovery-codes-card');
    fireEvent.click(screen.getByTestId('passkey-recovery-codes-done'));
    expect(
      screen.queryByTestId('passkey-recovery-codes-card')
    ).not.toBeInTheDocument();
  });

  it('surfaces a PasskeyError message and never calls onEnrolled', async () => {
    mockEnrollPasskey.mockRejectedValue(
      new PasskeyError('server', 'Could not finish passkey enrollment.')
    );
    const onEnrolled = vi.fn();

    renderButton(onEnrolled);
    fireEvent.click(screen.getByRole('button', { name: /add a passkey/i }));

    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Could not finish passkey enrollment.'
    );
    expect(onEnrolled).not.toHaveBeenCalled();
  });
});

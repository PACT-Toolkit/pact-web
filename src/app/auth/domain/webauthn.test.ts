import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/src/framework/auth/pact_auth/web_mutations';

import { completeMfaWithPasskey, PasskeyError } from './webauthn';

// completeMfaWithPasskey is the one webauthn.ts ceremony with logic this PR
// changed (PACT-697's Wrap-up review caught it): the finish route's failure
// carries a { code, error } body that AuthLoginMfaChallengeForm's catch
// block needs to redirect on, same as the TOTP path - see the function's
// own docblock. signInWithPasskey/enrollPasskey above it are untouched and
// stay covered by mock-mode E2E only, consistent with the rest of this file.
const jsonResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const fakeCredential = (): PublicKeyCredential =>
  ({
    id: 'cred-1',
    rawId: new TextEncoder().encode('cred-1').buffer,
    type: 'public-key',
    authenticatorAttachment: null,
    response: {
      clientDataJSON: new TextEncoder().encode('client-data').buffer,
      authenticatorData: new TextEncoder().encode('authenticator-data').buffer,
      signature: new TextEncoder().encode('signature').buffer,
      userHandle: null,
    },
    getClientExtensionResults: () => ({}),
  }) as unknown as PublicKeyCredential;

const beginOptionsBody = {
  ceremonyId: 'cer-1',
  options: { challenge: 'Y2hhbGxlbmdl', allowCredentials: [] },
};

describe('completeMfaWithPasskey', () => {
  const fetchMock = vi.fn<typeof fetch>();
  const credentialsGetMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    credentialsGetMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    Object.defineProperty(window, 'PublicKeyCredential', {
      value: function PublicKeyCredentialStub() {},
      configurable: true,
    });
    Object.defineProperty(navigator, 'credentials', {
      value: { create: vi.fn(), get: credentialsGetMock },
      configurable: true,
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error - test-only cleanup of the jsdom stub above.
    delete window.PublicKeyCredential;
    // @ts-expect-error - test-only cleanup of the jsdom stub above.
    delete navigator.credentials;
  });

  it('throws PasskeyError("unsupported") when the browser lacks WebAuthn', async () => {
    // @ts-expect-error - simulate a browser with no Credential Management API.
    delete navigator.credentials;

    const err = await completeMfaWithPasskey().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(PasskeyError);
    expect((err as PasskeyError).code).toBe('unsupported');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('throws ApiError carrying the code when begin fails', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: 'No sign-in in progress. Start again.', code: 'no_challenge' },
        401
      )
    );

    const err = await completeMfaWithPasskey().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).info?.code).toBe('no_challenge');
    expect(credentialsGetMock).not.toHaveBeenCalled();
  });

  it('throws PasskeyError("cancelled") when the authenticator prompt is dismissed', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(beginOptionsBody));
    credentialsGetMock.mockRejectedValueOnce(
      new DOMException('dismissed', 'NotAllowedError')
    );

    const err = await completeMfaWithPasskey().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(PasskeyError);
    expect((err as PasskeyError).code).toBe('cancelled');
    // Cancelling before a finish call must never reach the server - the
    // mfa_token stays alive, which is the whole point of the cancel path.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws ApiError with passkey_failed when the assertion fails verification', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(beginOptionsBody))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error:
              'Your passkey could not be verified. Enter your password again.',
            code: 'passkey_failed',
          },
          401
        )
      );
    credentialsGetMock.mockResolvedValueOnce(fakeCredential());

    const err = await completeMfaWithPasskey().catch((e: unknown) => e);

    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).info?.code).toBe('passkey_failed');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/mfa/passkey/finish');
  });

  it('resolves when the assertion verifies', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(beginOptionsBody))
      .mockResolvedValueOnce(jsonResponse({}));
    credentialsGetMock.mockResolvedValueOnce(fakeCredential());

    await expect(completeMfaWithPasskey()).resolves.toBeUndefined();
  });
});

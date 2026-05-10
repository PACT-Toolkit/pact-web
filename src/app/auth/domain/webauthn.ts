// Browser-side WebAuthn helpers for the passkey login + enrollment flows.
//
// pact-auth speaks the WebAuthn JSON shape (PublicKeyCredentialCreationOptions
// and AuthenticatorAttestationResponse / AuthenticatorAssertionResponse).
// The wire format is JSON-with-base64url for binary fields, so we hop in/out
// of ArrayBuffer here and keep the rest of the codebase in plain JSON.
//
// Why no `@simplewebauthn/browser`: we already proxy the server flow through
// our Next route handlers, so a 1.5 KB helper avoids pulling another dep into
// the auth bundle. If we grow more ceremonies (e.g. conditional UI hints,
// large-blob ext) it's worth revisiting.

const PASSKEY_PROMPT_DISMISSED_KEY = 'pact:passkey-prompt-dismissed';

export const isWebAuthnSupported = (): boolean => {
  if (typeof window === 'undefined') return false;

  return (
    typeof window.PublicKeyCredential === 'function' &&
    typeof navigator !== 'undefined' &&
    !!navigator.credentials &&
    typeof navigator.credentials.create === 'function' &&
    typeof navigator.credentials.get === 'function'
  );
};

// Conditional UI / autofill — lets the browser surface passkeys in the
// email field's autofill list without the user clicking the passkey CTA.
// Returns false if the platform doesn't advertise the capability.
export const isConditionalMediationSupported = async (): Promise<boolean> => {
  if (!isWebAuthnSupported()) return false;
  const pkc = window.PublicKeyCredential as typeof PublicKeyCredential & {
    isConditionalMediationAvailable?: () => Promise<boolean>;
  };
  if (typeof pkc.isConditionalMediationAvailable !== 'function') return false;
  try {
    return await pkc.isConditionalMediationAvailable();
  } catch {
    return false;
  }
};

// pact-auth uses base64url (RFC 4648 §5) for every binary field on the wire,
// matching the WebAuthn JSON serialization spec. URL-safe alphabet, no padding.
//
// We return ArrayBuffer (not Uint8Array) because the WebAuthn `BufferSource`
// fields require an ArrayBuffer-backed view; modern lib.dom.d.ts narrows
// Uint8Array's buffer to ArrayBufferLike which trips the structural checks.
const base64UrlToBuffer = (s: string): ArrayBuffer => {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4));
  const normalized = s.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(normalized);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i += 1) view[i] = bin.charCodeAt(i);

  return buf;
};

const bytesToBase64Url = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 1)
    bin += String.fromCharCode(bytes[i]);

  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

type PublicKeyCredentialDescriptorJSON = {
  type: 'public-key';
  id: string;
  transports?: AuthenticatorTransport[];
};

type PublicKeyCredentialCreationOptionsJSON = {
  rp: PublicKeyCredentialRpEntity;
  user: { id: string; name: string; displayName: string };
  challenge: string;
  pubKeyCredParams: PublicKeyCredentialParameters[];
  timeout?: number;
  excludeCredentials?: PublicKeyCredentialDescriptorJSON[];
  authenticatorSelection?: AuthenticatorSelectionCriteria;
  attestation?: AttestationConveyancePreference;
  extensions?: AuthenticationExtensionsClientInputs;
};

type PublicKeyCredentialRequestOptionsJSON = {
  challenge: string;
  timeout?: number;
  rpId?: string;
  allowCredentials?: PublicKeyCredentialDescriptorJSON[];
  userVerification?: UserVerificationRequirement;
  extensions?: AuthenticationExtensionsClientInputs;
};

const decodeCreationOptions = (
  json: PublicKeyCredentialCreationOptionsJSON
): PublicKeyCredentialCreationOptions => ({
  ...json,
  challenge: base64UrlToBuffer(json.challenge),
  user: {
    ...json.user,
    id: base64UrlToBuffer(json.user.id),
  },
  excludeCredentials: json.excludeCredentials?.map((c) => ({
    ...c,
    id: base64UrlToBuffer(c.id),
  })),
});

const decodeRequestOptions = (
  json: PublicKeyCredentialRequestOptionsJSON
): PublicKeyCredentialRequestOptions => ({
  ...json,
  challenge: base64UrlToBuffer(json.challenge),
  allowCredentials: json.allowCredentials?.map((c) => ({
    ...c,
    id: base64UrlToBuffer(c.id),
  })),
});

const encodeAttestation = (
  cred: PublicKeyCredential
): Record<string, unknown> => {
  const r = cred.response as AuthenticatorAttestationResponse;

  return {
    id: cred.id,
    rawId: bytesToBase64Url(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? null,
    response: {
      clientDataJSON: bytesToBase64Url(r.clientDataJSON),
      attestationObject: bytesToBase64Url(r.attestationObject),
      transports:
        typeof r.getTransports === 'function' ? r.getTransports() : [],
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
};

const encodeAssertion = (
  cred: PublicKeyCredential
): Record<string, unknown> => {
  const r = cred.response as AuthenticatorAssertionResponse;

  return {
    id: cred.id,
    rawId: bytesToBase64Url(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? null,
    response: {
      clientDataJSON: bytesToBase64Url(r.clientDataJSON),
      authenticatorData: bytesToBase64Url(r.authenticatorData),
      signature: bytesToBase64Url(r.signature),
      userHandle: r.userHandle ? bytesToBase64Url(r.userHandle) : null,
    },
    clientExtensionResults: cred.getClientExtensionResults(),
  };
};

export class PasskeyError extends Error {
  readonly code:
    | 'unsupported'
    | 'cancelled'
    | 'no_credentials'
    | 'server'
    | 'unknown';
  constructor(code: PasskeyError['code'], message: string) {
    super(message);
    this.code = code;
    this.name = 'PasskeyError';
  }
}

const mapDomError = (err: unknown): PasskeyError => {
  if (err instanceof PasskeyError) return err;
  if (err instanceof DOMException) {
    // NotAllowedError covers both "user dismissed prompt" and "no matching
    // credential" — the spec is intentionally vague to avoid leaking which
    // accounts have passkeys, so we surface a single generic message.
    if (err.name === 'NotAllowedError') {
      return new PasskeyError(
        'cancelled',
        'Passkey prompt was cancelled or no matching passkey was available.'
      );
    }
    if (err.name === 'AbortError') {
      return new PasskeyError('cancelled', 'Passkey prompt was cancelled.');
    }
    if (err.name === 'InvalidStateError') {
      return new PasskeyError(
        'no_credentials',
        'This passkey is already registered for your account.'
      );
    }
  }

  return new PasskeyError(
    'unknown',
    err instanceof Error ? err.message : 'Passkey operation failed.'
  );
};

// Run the full passkey login ceremony end-to-end. `email` is optional: when
// omitted the browser uses discoverable credentials (resident keys), which
// is the recommended UX for the "Sign in with a passkey" button.
//
// `signal` lets the caller abort an in-flight conditional-UI prompt when the
// user switches to password login instead.
export const signInWithPasskey = async ({
  email,
  signal,
  mediation,
}: {
  email?: string;
  signal?: AbortSignal;
  mediation?: CredentialMediationRequirement;
} = {}): Promise<void> => {
  if (!isWebAuthnSupported()) {
    throw new PasskeyError(
      'unsupported',
      "This browser doesn't support passkeys. Use email and password instead."
    );
  }

  let beginRes: Response;
  try {
    beginRes = await fetch('/api/auth/passkey/login/begin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email ?? '' }),
      signal,
    });
  } catch (err) {
    throw mapDomError(err);
  }
  if (!beginRes.ok) {
    throw new PasskeyError('server', 'Could not start passkey sign-in.');
  }
  const begin = (await beginRes.json()) as {
    ceremonyId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  };

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.get({
      publicKey: decodeRequestOptions(begin.options),
      mediation,
      signal,
    })) as PublicKeyCredential | null;
  } catch (err) {
    throw mapDomError(err);
  }
  if (!credential) {
    throw new PasskeyError('cancelled', 'No passkey was selected.');
  }

  const finishRes = await fetch('/api/auth/passkey/login/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ceremonyId: begin.ceremonyId,
      assertion: encodeAssertion(credential),
    }),
  });
  if (!finishRes.ok) {
    const payload = (await finishRes.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new PasskeyError(
      'server',
      payload?.error ?? 'Passkey sign-in failed.'
    );
  }
};

// Enroll a new passkey for the currently signed-in user. The session token
// stays server-side — only the passkey label is sent from the browser.
export const enrollPasskey = async ({
  label,
}: {
  label: string;
}): Promise<{ credentialId: string }> => {
  if (!isWebAuthnSupported()) {
    throw new PasskeyError(
      'unsupported',
      "This browser doesn't support passkeys."
    );
  }

  const beginRes = await fetch('/api/auth/passkey/register/begin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label }),
  });
  if (!beginRes.ok) {
    const payload = (await beginRes.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new PasskeyError(
      'server',
      payload?.error ?? 'Could not start passkey enrollment.'
    );
  }
  const begin = (await beginRes.json()) as {
    ceremonyId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  };

  let credential: PublicKeyCredential | null;
  try {
    credential = (await navigator.credentials.create({
      publicKey: decodeCreationOptions(begin.options),
    })) as PublicKeyCredential | null;
  } catch (err) {
    throw mapDomError(err);
  }
  if (!credential) {
    throw new PasskeyError('cancelled', 'Passkey enrollment was cancelled.');
  }

  const finishRes = await fetch('/api/auth/passkey/register/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ceremonyId: begin.ceremonyId,
      attestation: encodeAttestation(credential),
    }),
  });
  if (!finishRes.ok) {
    const payload = (await finishRes.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new PasskeyError(
      'server',
      payload?.error ?? 'Could not finish passkey enrollment.'
    );
  }

  return (await finishRes.json()) as { credentialId: string };
};

// In-process pubsub so React subscribers (`usePasskeyPromptHidden`)
// re-read the localStorage-backed snapshot whenever the prompt state
// changes. Without this, two components reading the same flags would
// each keep stale `useState` copies and only resync on remount.
const passkeyPromptListeners = new Set<() => void>();

const emitPasskeyPromptChanged = (): void => {
  for (const cb of passkeyPromptListeners) cb();
};

// Subscribe to enrollment / dismissal changes for this tab. Returns
// the unsubscribe function expected by `useSyncExternalStore`. Also
// listens to cross-tab `storage` events so a dismiss in another tab
// hides the prompt here too.
export const subscribePasskeyPromptState = (cb: () => void): (() => void) => {
  passkeyPromptListeners.add(cb);
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', cb);
  }

  return () => {
    passkeyPromptListeners.delete(cb);
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', cb);
    }
  };
};

// Local hint that the user has at least one passkey on this account. Persists
// across reloads so the nudge banner doesn't reappear after enrollment, even
// before the next session refresh syncs server state.
export const markPasskeyEnrolledLocally = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem('pact:has-passkey', '1');
  } catch {
    // Storage might be disabled (e.g. private mode); banner will simply
    // re-appear next visit, which is acceptable.
  }
  emitPasskeyPromptChanged();
};

export const hasPasskeyHintLocally = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem('pact:has-passkey') === '1';
  } catch {
    return false;
  }
};

export const dismissPasskeyPrompt = (): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PASSKEY_PROMPT_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
  emitPasskeyPromptChanged();
};

export const isPasskeyPromptDismissed = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(PASSKEY_PROMPT_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};
